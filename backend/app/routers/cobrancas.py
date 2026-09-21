from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.cobranca import Cobranca
from app.models.enums import CobrancaStatus, MatriculaStatus, PagamentoMeio, Role
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.cobranca import (
    CobrancaAlunoOut,
    CobrancaCreate,
    CobrancaOut,
    CobrancaUpdate,
    MensalidadesGeradasOut,
)
from app.services import cobrancas as servico
from app.services.email import enviar_cobranca_email
from app.services.whatsapp import enviar_cobranca_whatsapp

router = APIRouter(prefix="/cobrancas", tags=["cobrancas"])

Admin = Annotated[User, Depends(require_role(Role.ADMIN_POINT))]
DB = Annotated[Session, Depends(get_db)]


def _alunos_do_point(db: Session, point_id: int) -> list[Aluno]:
    """Quem já tem alguma relação com o Point: assinatura ou matrícula em
    turma dele (Aluno é global, não pertence a um Point só)."""
    por_assinatura = db.query(Assinatura.aluno_id).filter(Assinatura.point_id == point_id)
    por_matricula = (
        db.query(Matricula.aluno_id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(Vinculo.point_id == point_id)
    )
    return (
        db.query(Aluno)
        .filter(Aluno.id.in_(por_assinatura) | Aluno.id.in_(por_matricula))
        .order_by(Aluno.nome)
        .all()
    )


def _get_cobranca(db: Session, cobranca_id: int, admin: User) -> Cobranca:
    cobranca = db.get(Cobranca, cobranca_id)
    if cobranca is None or cobranca.point_id != admin.point_id:
        raise HTTPException(404, "Cobrança não encontrada")
    return cobranca


@router.get("", response_model=list[CobrancaOut])
def listar_cobrancas(db: DB, admin: Admin) -> list[Cobranca]:
    """Todas as abertas + as pagas dos últimos 180 dias — a tela filtra e
    soma no cliente (o volume de um Point cabe folgado)."""
    corte = date.today() - timedelta(days=180)
    return (
        db.query(Cobranca)
        .filter(
            Cobranca.point_id == admin.point_id,
            (Cobranca.status == CobrancaStatus.ABERTA) | (Cobranca.pago_em >= corte),
        )
        .order_by(Cobranca.vencimento)
        .all()
    )


@router.get("/alunos", response_model=list[CobrancaAlunoOut])
def listar_alunos_cobrancas(db: DB, admin: Admin) -> list[Aluno]:
    return _alunos_do_point(db, admin.point_id)


@router.get("/mensalidades-automaticas")
def contar_mensalidades_automaticas(db: DB, admin: Admin) -> dict[str, int]:
    """Quantos alunos têm mensalidade automática (assinatura ativa por Pix
    com plano) — o "N com mensalidade automática" do topo da tela."""
    total = (
        db.query(Assinatura)
        .filter(
            Assinatura.point_id == admin.point_id,
            Assinatura.status == MatriculaStatus.ATIVA,
            Assinatura.fonte_pagamento == PagamentoMeio.PIX,
            Assinatura.plano_id.is_not(None),
        )
        .count()
    )
    return {"total": total}


@router.post("", response_model=CobrancaOut, status_code=201)
def criar_cobranca(payload: CobrancaCreate, db: DB, admin: Admin) -> Cobranca:
    if payload.aluno_id not in {a.id for a in _alunos_do_point(db, admin.point_id)}:
        raise HTTPException(404, "Aluno não encontrado neste Point")
    cobranca = Cobranca(
        point_id=admin.point_id,
        aluno_id=payload.aluno_id,
        descricao=payload.descricao.strip(),
        valor=payload.valor,
        vencimento=payload.vencimento,
        status=CobrancaStatus.ABERTA,
    )
    db.add(cobranca)
    db.commit()
    db.refresh(cobranca)
    return cobranca


@router.post("/gerar-mensalidades", response_model=MensalidadesGeradasOut)
def gerar_mensalidades_agora(db: DB, admin: Admin) -> MensalidadesGeradasOut:
    criadas = servico.gerar_mensalidades(db, point_id=admin.point_id)
    return MensalidadesGeradasOut(criadas=criadas)


@router.patch("/{cobranca_id}", response_model=CobrancaOut)
def editar_cobranca(
    cobranca_id: int, payload: CobrancaUpdate, db: DB, admin: Admin
) -> Cobranca:
    cobranca = _get_cobranca(db, cobranca_id, admin)
    if cobranca.status == CobrancaStatus.PAGA:
        raise HTTPException(422, "Cobrança paga não pode ser editada — desfaça o pagamento antes")
    if payload.descricao is not None:
        cobranca.descricao = payload.descricao.strip()
    if payload.valor is not None:
        cobranca.valor = payload.valor
    if payload.vencimento is not None:
        cobranca.vencimento = payload.vencimento
    db.commit()
    db.refresh(cobranca)
    return cobranca


@router.patch("/{cobranca_id}/pagar", response_model=CobrancaOut)
def pagar_cobranca(cobranca_id: int, db: DB, admin: Admin) -> Cobranca:
    cobranca = _get_cobranca(db, cobranca_id, admin)
    if cobranca.status == CobrancaStatus.PAGA:
        raise HTTPException(422, "Cobrança já está paga")
    servico.marcar_paga(db, cobranca)
    db.commit()
    db.refresh(cobranca)
    return cobranca


@router.patch("/{cobranca_id}/reabrir", response_model=CobrancaOut)
def reabrir_cobranca(cobranca_id: int, db: DB, admin: Admin) -> Cobranca:
    cobranca = _get_cobranca(db, cobranca_id, admin)
    if cobranca.status != CobrancaStatus.PAGA:
        raise HTTPException(422, "Só uma cobrança paga pode ser reaberta")
    servico.reabrir(db, cobranca)
    db.commit()
    db.refresh(cobranca)
    return cobranca


@router.post("/{cobranca_id}/lembrete", status_code=204)
def enviar_lembrete_cobranca(cobranca_id: int, db: DB, admin: Admin) -> None:
    """WhatsApp + e-mail (mesmo par dos convites) — cada canal é fail-soft,
    então sem credencial configurada só loga."""
    cobranca = _get_cobranca(db, cobranca_id, admin)
    if cobranca.status == CobrancaStatus.PAGA:
        raise HTTPException(422, "Essa cobrança já está paga")
    aluno = cobranca.aluno
    point_nome = db.get(Point, admin.point_id).nome
    vencimento = cobranca.vencimento.strftime("%d/%m")
    enviar_cobranca_whatsapp(
        celular=aluno.contato,
        nome=aluno.nome,
        point_nome=point_nome,
        descricao=cobranca.descricao,
        valor=f"{float(cobranca.valor):.2f}".replace(".", ","),
        vencimento=vencimento,
    )
    enviar_cobranca_email(
        nome=aluno.nome,
        email=aluno.email,
        point_nome=point_nome,
        descricao=cobranca.descricao,
        valor=float(cobranca.valor),
        vencimento=vencimento,
    )


@router.delete("/{cobranca_id}", status_code=204)
def remover_cobranca(cobranca_id: int, db: DB, admin: Admin) -> None:
    cobranca = _get_cobranca(db, cobranca_id, admin)
    if cobranca.status == CobrancaStatus.PAGA:
        raise HTTPException(422, "Cobrança paga não pode ser removida — desfaça o pagamento antes")
    db.delete(cobranca)
    db.commit()
