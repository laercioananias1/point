from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import (
    ExperimentalConfig,
    NotificacaoTipo,
    Role,
    SolicitacaoExperimentalStatus,
    VinculoStatus,
)
from app.models.point import Point
from app.models.solicitacao_experimental import SolicitacaoExperimental
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.point import PointResumo
from app.schemas.solicitacao_experimental import (
    DisponibilidadeDia,
    SolicitacaoExperimentalCriar,
    SolicitacaoExperimentalOut,
    SolicitacaoExperimentalRecusa,
    TurmaExperimentalAgendaOut,
    TurmaExperimentalOut,
)
from app.services.aulas import DIAS_SEMANA, vagas_ocupadas_em
from app.services.feriados import feriados_do_periodo
from app.services.notificacoes import criar_notificacao

router = APIRouter(prefix="/experimental", tags=["experimental"])

# Janela padrão da agenda pública (pedido do usuário, 2026-09-14) — dá pra
# ver e pedir aula experimental nas próximas ~3 semanas; não tem sentido
# oferecer uma agenda pública infinita pra frente.
DIAS_AGENDA_PADRAO = 21


def _resolver_point_por_link(db: Session, link: str) -> Point:
    """Resolve o Point pelo token opaco do link público (pedido do
    usuário, 2026-09-14: "colocar o id visivel nao é uma boa... criar uma
    hash mas nao identificar o id na url") — nunca pelo id sequencial, pra
    não dar pra enumerar todos os Points só trocando o número na URL."""
    point = db.query(Point).filter(Point.link_experimental == link).first()
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    return point


def _query_turmas_elegiveis(db: Session, point_id: int):
    return (
        db.query(Turma)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == point_id,
            Vinculo.status == VinculoStatus.ATIVO,
            Turma.aula_experimental != ExperimentalConfig.NAO,
            or_(Turma.periodo_fim.is_(None), Turma.periodo_fim >= date.today()),
        )
    )


def _proximas_datas(db: Session, turma: Turma, dias: int) -> list[DisponibilidadeDia]:
    hoje = date.today()
    fim = hoje + timedelta(days=dias)
    inicio = max(hoje, turma.periodo_inicio)
    if turma.periodo_fim is not None:
        fim = min(fim, turma.periodo_fim)
    if inicio > fim:
        return []

    excluidas = set(turma.excecoes) | set(feriados_do_periodo(db, turma.vinculo.point_id, inicio, fim))

    resultado: list[DisponibilidadeDia] = []
    dia_atual = inicio
    while dia_atual <= fim:
        if DIAS_SEMANA[dia_atual.weekday()] in turma.dias_semana and dia_atual not in excluidas:
            ocupadas = vagas_ocupadas_em(db, turma, dia_atual)
            resultado.append(DisponibilidadeDia(data=dia_atual, disponivel=ocupadas < turma.capacidade))
        dia_atual += timedelta(days=1)
    return resultado


@router.get("/{link}/point", response_model=PointResumo)
def ver_point_experimental(link: str, db: Annotated[Session, Depends(get_db)]) -> Point:
    """Pública, sem login — nome/logo/endereço do Point pra vitrine de aula
    experimental (pedido do usuário, 2026-09-14). Mesmo schema já usado em
    outras telas públicas/semi-públicas (ConviteOut), nada de dado de
    gestão exposto."""
    return _resolver_point_por_link(db, link)


@router.get("/{link}/turmas", response_model=list[TurmaExperimentalOut])
def listar_turmas_experimentais(link: str, db: Annotated[Session, Depends(get_db)]) -> list[Turma]:
    """Pública, sem login — vitrine das turmas que esse Point abriu pra
    aula experimental (pedido do usuário, 2026-09-14)."""
    point = _resolver_point_por_link(db, link)
    return _query_turmas_elegiveis(db, point.id).all()


@router.get("/{link}/agenda", response_model=list[TurmaExperimentalAgendaOut])
def agenda_experimental(
    link: str, db: Annotated[Session, Depends(get_db)], dias: int = DIAS_AGENDA_PADRAO
) -> list[TurmaExperimentalAgendaOut]:
    """Mesma vitrine, já com as próximas datas e se tem vaga em cada uma —
    só ✓/✕ (pedido do usuário, mesmo espírito do modo "disponibilidade" do
    GraficoOcupacao): visitante sem login nunca vê número de ocupação
    real de ninguém."""
    point = _resolver_point_por_link(db, link)
    turmas = _query_turmas_elegiveis(db, point.id).all()
    dias = max(1, min(dias, 60))
    return [
        TurmaExperimentalAgendaOut(
            **TurmaExperimentalOut.model_validate(turma).model_dump(),
            proximas_datas=_proximas_datas(db, turma, dias),
        )
        for turma in turmas
    ]


@router.post("/solicitar", response_model=SolicitacaoExperimentalOut, status_code=201)
def solicitar_aula_experimental(
    payload: SolicitacaoExperimentalCriar, db: Annotated[Session, Depends(get_db)]
) -> SolicitacaoExperimental:
    """Pública, sem login — o visitante escolhe turma+data na agenda e
    manda os próprios dados (pedido do usuário, 2026-09-14). Fica
    PENDENTE até o professor ou o admin do Point aprovar/recusar."""
    turma = db.get(Turma, payload.turma_id)
    if turma is None or turma.aula_experimental == ExperimentalConfig.NAO:
        raise HTTPException(404, "Turma não encontrada")
    if turma.vinculo.status != VinculoStatus.ATIVO:
        raise HTTPException(404, "Turma não encontrada")

    if payload.data < date.today():
        raise HTTPException(422, "Escolha uma data futura")
    if DIAS_SEMANA[payload.data.weekday()] not in turma.dias_semana:
        raise HTTPException(422, "Essa turma não tem aula nesse dia da semana")
    if payload.data < turma.periodo_inicio or (
        turma.periodo_fim is not None and payload.data > turma.periodo_fim
    ):
        raise HTTPException(422, "Essa data está fora do período da turma")
    if payload.data in turma.excecoes:
        raise HTTPException(422, "Essa data foi cancelada — escolha outra")

    if vagas_ocupadas_em(db, turma, payload.data) >= turma.capacidade:
        raise HTTPException(409, "Essa vaga acabou de ser preenchida — escolha outro horário")

    duplicada = (
        db.query(SolicitacaoExperimental)
        .filter(
            SolicitacaoExperimental.turma_id == turma.id,
            SolicitacaoExperimental.data == payload.data,
            SolicitacaoExperimental.email == payload.email,
            SolicitacaoExperimental.status != SolicitacaoExperimentalStatus.RECUSADA,
        )
        .first()
    )
    if duplicada is not None:
        raise HTTPException(409, "Você já tem uma solicitação pra essa aula")

    solicitacao = SolicitacaoExperimental(
        turma_id=turma.id,
        data=payload.data,
        nome=payload.nome,
        email=payload.email,
        celular=payload.celular,
        tem_raquete=payload.tem_raquete,
    )
    db.add(solicitacao)
    db.commit()
    db.refresh(solicitacao)

    # Avisa quem precisa aprovar — o professor da turma e todo admin do
    # Point (pedido do usuário: "cai para os professores ou adm").
    destinatarios = (
        db.query(User)
        .filter(
            or_(
                User.professor_id == turma.vinculo.professor_id,
                User.point_id == turma.vinculo.point_id,
            )
        )
        .all()
    )
    for destinatario in destinatarios:
        if destinatario.tem_role(Role.PROFESSOR) or destinatario.tem_role(Role.ADMIN_POINT):
            criar_notificacao(
                db,
                user_id=destinatario.id,
                tipo=NotificacaoTipo.SOLICITACAO_EXPERIMENTAL,
                titulo="Pedido de aula experimental",
                mensagem=(
                    f"{payload.nome} pediu uma aula experimental de {turma.modalidade.nome} "
                    f"no dia {payload.data.strftime('%d/%m')}."
                ),
            )

    return solicitacao


def _pode_decidir(user: User, turma: Turma) -> bool:
    return (user.tem_role(Role.PROFESSOR) and turma.vinculo.professor_id == user.professor_id) or (
        user.tem_role(Role.ADMIN_POINT) and turma.vinculo.point_id == user.point_id
    )


@router.get("/solicitacoes", response_model=list[SolicitacaoExperimentalOut])
def listar_solicitacoes(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
    status: SolicitacaoExperimentalStatus | None = None,
) -> list[SolicitacaoExperimental]:
    """Admin vê as de todo o Point; professor (sem ser admin) só as das
    próprias turmas (pedido do usuário, 2026-09-14: "cai para os
    professores ou adm e autorizam")."""
    query = db.query(SolicitacaoExperimental).join(Turma, SolicitacaoExperimental.turma_id == Turma.id).join(
        Vinculo, Turma.vinculo_id == Vinculo.id
    )
    if user.tem_role(Role.ADMIN_POINT):
        query = query.filter(Vinculo.point_id == user.point_id)
    else:
        query = query.filter(Vinculo.professor_id == user.professor_id)
    if status is not None:
        query = query.filter(SolicitacaoExperimental.status == status)
    return query.order_by(SolicitacaoExperimental.created_at.desc()).all()


@router.patch("/solicitacoes/{solicitacao_id}/aprovar", response_model=SolicitacaoExperimentalOut)
def aprovar_solicitacao(
    solicitacao_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> SolicitacaoExperimental:
    solicitacao = db.get(SolicitacaoExperimental, solicitacao_id)
    if solicitacao is None or not _pode_decidir(user, solicitacao.turma):
        raise HTTPException(404, "Solicitação não encontrada")
    if solicitacao.status != SolicitacaoExperimentalStatus.PENDENTE:
        raise HTTPException(422, "Essa solicitação já foi decidida")

    # Recontagem na hora de aprovar (pedido do usuário — mesma vaga que a
    # checagem pública usa) — protege contra duas solicitações pendentes
    # tentando ocupar a mesma vaga ao mesmo tempo; a própria solicitação
    # já conta como pendente, então compara contra capacidade+1.
    ocupadas = vagas_ocupadas_em(db, solicitacao.turma, solicitacao.data)
    if ocupadas > solicitacao.turma.capacidade:
        raise HTTPException(409, "Essa turma já está sem vaga nessa data")

    solicitacao.status = SolicitacaoExperimentalStatus.APROVADA
    solicitacao.decidido_por_id = user.id
    solicitacao.decidido_em = datetime.now()
    db.commit()
    db.refresh(solicitacao)
    return solicitacao


@router.patch("/solicitacoes/{solicitacao_id}/recusar", response_model=SolicitacaoExperimentalOut)
def recusar_solicitacao(
    solicitacao_id: int,
    payload: SolicitacaoExperimentalRecusa,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> SolicitacaoExperimental:
    solicitacao = db.get(SolicitacaoExperimental, solicitacao_id)
    if solicitacao is None or not _pode_decidir(user, solicitacao.turma):
        raise HTTPException(404, "Solicitação não encontrada")
    if solicitacao.status != SolicitacaoExperimentalStatus.PENDENTE:
        raise HTTPException(422, "Essa solicitação já foi decidida")

    solicitacao.status = SolicitacaoExperimentalStatus.RECUSADA
    solicitacao.motivo_recusa = payload.motivo_recusa
    solicitacao.decidido_por_id = user.id
    solicitacao.decidido_em = datetime.now()
    db.commit()
    db.refresh(solicitacao)
    return solicitacao
