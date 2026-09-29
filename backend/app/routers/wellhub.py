import calendar
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.aluno import Aluno
from app.models.checkin import Checkin
from app.models.enums import CheckinStatus, PagamentoMeio, Role
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.models.wellhub_checkin import WellhubCheckin
from app.schemas.wellhub import (
    WellhubCheckinCreate,
    WellhubCheckinOut,
    WellhubReconciliacaoLinha,
    WellhubReconciliacaoOut,
)
from app.services.wellhub import WellhubError, validar_checkin

router = APIRouter(prefix="/wellhub", tags=["wellhub"])

Admin = Annotated[User, Depends(require_role(Role.ADMIN_POINT))]
DB = Annotated[Session, Depends(get_db)]


def registrar_checkin(db: Session, *, point_id: int, gympass_id: str, nome: str | None, origem: str) -> WellhubCheckin:
    """Grava (ou devolve, se já existia) o check-in do dia — idempotente
    pelo par point_id+gympass_id+data, mesma trava que a própria Wellhub já
    aplica do lado dela (1 check-in por dia por usuário)."""
    hoje = date.today()
    existente = (
        db.query(WellhubCheckin)
        .filter(
            WellhubCheckin.point_id == point_id,
            WellhubCheckin.gympass_id == gympass_id,
            WellhubCheckin.data == hoje,
        )
        .first()
    )
    if existente is not None:
        return existente

    aluno = db.query(Aluno.id).filter(Aluno.wellhub_gympass_id == gympass_id).first()
    checkin = WellhubCheckin(
        point_id=point_id,
        gympass_id=gympass_id,
        aluno_id=aluno[0] if aluno else None,
        data=hoje,
        nome_wellhub=nome,
        origem=origem,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def _intervalo_do_mes(mes: str | None) -> tuple[date, date]:
    """"YYYY-MM" -> (primeiro dia, último dia) do mês; None = mês
    corrente. Compartilhado entre listagem e reconciliação."""
    if mes:
        try:
            ano, mes_num = (int(p) for p in mes.split("-"))
        except ValueError:
            raise HTTPException(422, "Mês precisa estar no formato YYYY-MM") from None
    else:
        hoje = date.today()
        ano, mes_num = hoje.year, hoje.month
    return date(ano, mes_num, 1), date(ano, mes_num, calendar.monthrange(ano, mes_num)[1])


@router.get("/checkins", response_model=list[WellhubCheckinOut])
def listar_checkins(db: DB, admin: Admin, mes: str | None = None) -> list[WellhubCheckin]:
    """Check-ins validados desse Point (pedido do usuário, 2026-09-29:
    "tem uma tela dos checkins feitos?") — mais recentes primeiro. `mes` no
    formato "YYYY-MM"; padrão o mês corrente."""
    inicio, fim = _intervalo_do_mes(mes)
    return (
        db.query(WellhubCheckin)
        .filter(
            WellhubCheckin.point_id == admin.point_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .order_by(WellhubCheckin.data.desc(), WellhubCheckin.id.desc())
        .all()
    )


@router.post("/checkins", response_model=WellhubCheckinOut, status_code=201)
def registrar_checkin_manual(payload: WellhubCheckinCreate, db: DB, admin: Admin) -> WellhubCheckin:
    """Check-in manual (pedido do usuário, 2026-09-22) — o admin digita o
    Gympass ID de 13 dígitos que aparece no app do aluno, sem depender do
    webhook estar cadastrado ainda."""
    from app.models.point import Point

    point = db.get(Point, admin.point_id)
    if point is None or not point.wellhub_gym_id:
        raise HTTPException(
            422, "Esse Point ainda não tem o Gym ID da Wellhub configurado (Configurações)"
        )

    try:
        # A chamada em si (evento "validate") já loga sucesso/erro sozinha
        # — ver services/wellhub.py.
        beneficiario = validar_checkin(
            gym_id=point.wellhub_gym_id, gympass_id=payload.gympass_id, point_id=point.id
        )
    except WellhubError as erro:
        raise HTTPException(422, str(erro)) from erro

    return registrar_checkin(
        db,
        point_id=point.id,
        gympass_id=payload.gympass_id,
        nome=beneficiario.get("nome"),
        origem="manual",
    )


@router.get("/reconciliacao", response_model=WellhubReconciliacaoOut)
def reconciliacao_do_mes(db: DB, admin: Admin, mes: str | None = None) -> WellhubReconciliacaoOut:
    """"Acerto do mês" (pedido do usuário, 2026-09-29: "trabalhar com
    saldos de checkin e qtde aulas feitas, pra ter um acerto no final do
    mes") — lado a lado, por gympass_id: quantos check-ins a Wellhub
    validou nesse Point e quantas aulas esse aluno de fato frequentou.
    Puramente informativo — não bloqueia matrícula nem presença.
    `mes` no formato "YYYY-MM"; padrão o mês corrente."""
    inicio, fim = _intervalo_do_mes(mes)
    ano, mes_num = inicio.year, inicio.month
    inicio_dt = datetime(ano, mes_num, 1)
    fim_dt = datetime.combine(fim, datetime.max.time())

    checkins = (
        db.query(WellhubCheckin)
        .filter(
            WellhubCheckin.point_id == admin.point_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .all()
    )
    checkins_por_gympass: dict[str, int] = {}
    aluno_por_gympass: dict[str, int | None] = {}
    for c in checkins:
        checkins_por_gympass[c.gympass_id] = checkins_por_gympass.get(c.gympass_id, 0) + 1
        if c.aluno_id is not None:
            aluno_por_gympass[c.gympass_id] = c.aluno_id

    aulas = (
        db.query(Matricula.aluno_id, func.count(Checkin.id))
        .join(Checkin, Checkin.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == admin.point_id,
            Matricula.fonte_pagamento == PagamentoMeio.WELLHUB,
            Checkin.status == CheckinStatus.CONFIRMADO,
            Checkin.data_hora >= inicio_dt,
            Checkin.data_hora <= fim_dt,
        )
        .group_by(Matricula.aluno_id)
        .all()
    )
    aulas_por_aluno: dict[int, int] = dict(aulas)

    aluno_ids = {a for a in aluno_por_gympass.values() if a} | set(aulas_por_aluno)
    alunos = {a.id: a for a in db.query(Aluno).filter(Aluno.id.in_(aluno_ids)).all()} if aluno_ids else {}

    linhas: list[WellhubReconciliacaoLinha] = []
    gympass_ja_usado: set[str] = set()
    for gympass_id, qtd_checkins in checkins_por_gympass.items():
        aluno_id = aluno_por_gympass.get(gympass_id)
        aluno = alunos.get(aluno_id) if aluno_id else None
        linhas.append(
            WellhubReconciliacaoLinha(
                gympass_id=gympass_id,
                aluno_id=aluno_id,
                aluno_nome=aluno.nome if aluno else None,
                checkins_no_mes=qtd_checkins,
                aulas_no_mes=aulas_por_aluno.get(aluno_id, 0) if aluno_id else 0,
            )
        )
        gympass_ja_usado.add(gympass_id)

    # Alunos com aula frequentada mas cujo gympass_id não apareceu nos
    # check-ins deste mês (ou nunca foi vinculado) — ainda entram, pra não
    # esconder "aluno pagando Wellhub que não fez check-in nenhum".
    gympass_do_aluno = {v: k for k, v in aluno_por_gympass.items()}
    for aluno_id, qtd_aulas in aulas_por_aluno.items():
        gympass_id = gympass_do_aluno.get(aluno_id)
        if gympass_id in gympass_ja_usado:
            continue
        aluno = alunos.get(aluno_id)
        linhas.append(
            WellhubReconciliacaoLinha(
                gympass_id=gympass_id,
                aluno_id=aluno_id,
                aluno_nome=aluno.nome if aluno else None,
                checkins_no_mes=0,
                aulas_no_mes=qtd_aulas,
            )
        )

    linhas.sort(key=lambda linha: linha.aluno_nome or linha.gympass_id or "")
    return WellhubReconciliacaoOut(mes=f"{ano:04d}-{mes_num:02d}", linhas=linhas)
