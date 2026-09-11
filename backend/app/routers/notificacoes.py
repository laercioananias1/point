from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.notificacao import Notificacao
from app.models.user import User
from app.schemas.notificacao import ContagemNaoLidasOut, NotificacaoOut

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])

# Teto de quantas notificações a tela carrega de uma vez (pedido do
# usuário, 2026-09-11) — é um feed, não precisa de paginação ainda; 50 já
# cobre bem mais que o normal de avisos recentes.
LIMITE_LISTAGEM = 50


@router.get("", response_model=list[NotificacaoOut])
def listar_notificacoes(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[Notificacao]:
    return (
        db.query(Notificacao)
        .filter(Notificacao.user_id == user.id)
        .order_by(Notificacao.created_at.desc())
        .limit(LIMITE_LISTAGEM)
        .all()
    )


@router.get("/contagem-nao-lidas", response_model=ContagemNaoLidasOut)
def contar_nao_lidas(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ContagemNaoLidasOut:
    """Pro selo no sininho do cabeçalho (pedido do usuário, 2026-09-11) —
    consulta leve e separada da listagem, pra poder ser chamada toda hora
    (troca de tela) sem trazer o corpo das notificações de novo."""
    total = (
        db.query(Notificacao)
        .filter(Notificacao.user_id == user.id, Notificacao.lida.is_(False))
        .count()
    )
    return ContagemNaoLidasOut(nao_lidas=total)


@router.patch("/{notificacao_id}/lida", response_model=NotificacaoOut)
def marcar_lida(
    notificacao_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Notificacao:
    notificacao = db.get(Notificacao, notificacao_id)
    if notificacao is None or notificacao.user_id != user.id:
        raise HTTPException(404, "Notificação não encontrada")
    notificacao.lida = True
    db.commit()
    db.refresh(notificacao)
    return notificacao


@router.post("/marcar-todas-lidas", status_code=204)
def marcar_todas_lidas(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    db.query(Notificacao).filter(
        Notificacao.user_id == user.id, Notificacao.lida.is_(False)
    ).update({"lida": True}, synchronize_session=False)
    db.commit()
