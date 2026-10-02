"""Pagamento de cobrança pelo link público /pagar/<token> (pedido do
usuário, 2026-10-02: Pix pelo app, com link no e-mail e no WhatsApp). Sem
login — o token de 32 caracteres da cobrança é a chave, igual aos links
de convite."""

from datetime import date, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.cobranca import Cobranca
from app.models.enums import CobrancaStatus
from app.models.point import Point
from app.schemas.pagamento_online import PagamentoPublicoOut
from app.services.gateways import GatewayErro, gateway
from app.services.pix_cobranca import conferir_pix, garantir_pix, pagamento_online_ativo

router = APIRouter(prefix="/pagar", tags=["pagar"])

DB = Annotated[Session, Depends(get_db)]


def _cobranca(db: Session, token: str) -> Cobranca:
    cobranca = db.query(Cobranca).filter(Cobranca.pagamento_token == token).first()
    if cobranca is None:
        raise HTTPException(404, "Pagamento não encontrado — confira o link.")
    return cobranca


def _out(db: Session, cobranca: Cobranca) -> PagamentoPublicoOut:
    point = db.get(Point, cobranca.point_id)
    gw = gateway(point.pagamento_gateway) if point else None
    aberta = cobranca.status == CobrancaStatus.ABERTA
    return PagamentoPublicoOut(
        point_nome=point.nome if point else "",
        point_logo=point.logo if point else None,
        aluno_nome=cobranca.aluno.nome.split(" ")[0],
        descricao=cobranca.descricao,
        valor=float(cobranca.valor),
        vencimento=cobranca.vencimento,
        status=cobranca.status,
        atrasada=aberta and cobranca.vencimento < date.today(),
        pago_em=cobranca.pago_em,
        pago_via=cobranca.pago_via,
        pagamento_online=pagamento_online_ativo(point),
        gateway_rotulo=gw.rotulo if gw else None,
        pix_copia_cola=cobranca.pix_copia_cola if aberta else None,
        pix_qr_base64=cobranca.pix_qr_base64 if aberta else None,
        # Gravado em UTC sem fuso; sai com fuso pra tela mostrar a hora certa.
        pix_expira_em=cobranca.pix_expira_em.replace(tzinfo=timezone.utc) if aberta and cobranca.pix_expira_em else None,
        pagar_ate=cobranca.pagar_ate.replace(tzinfo=timezone.utc) if cobranca.pagar_ate else None,
        reserva=cobranca.matricula_id is not None,
    )


@router.get("/{token}", response_model=PagamentoPublicoOut)
def ver_pagamento(token: str, db: DB) -> PagamentoPublicoOut:
    """A tela chama de tempos em tempos enquanto espera o Pix — por isso
    já confere o status no gateway (cobre o caso do webhook não chegar)."""
    cobranca = _cobranca(db, token)
    if conferir_pix(db, cobranca):
        db.commit()
        db.refresh(cobranca)
    return _out(db, cobranca)


@router.post("/{token}/pix", response_model=PagamentoPublicoOut)
def gerar_pix(token: str, db: DB) -> PagamentoPublicoOut:
    """Gera o Pix (ou devolve o que ainda vale)."""
    cobranca = _cobranca(db, token)
    if cobranca.status == CobrancaStatus.PAGA:
        return _out(db, cobranca)
    if not pagamento_online_ativo(db.get(Point, cobranca.point_id)):
        raise HTTPException(409, "Este Point ainda não recebe pagamento online. Fale com a recepção.")
    try:
        garantir_pix(db, cobranca)
    except GatewayErro as erro:
        db.rollback()
        raise HTTPException(502, str(erro)) from erro
    db.commit()
    db.refresh(cobranca)
    return _out(db, cobranca)
