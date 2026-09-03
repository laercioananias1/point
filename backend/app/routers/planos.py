from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.assinatura import Assinatura
from app.models.convite import Convite
from app.models.enums import Role
from app.models.plano import Plano
from app.models.user import User
from app.schemas.plano import PlanoCreate, PlanoOut, PlanoUpdate

router = APIRouter(prefix="/planos", tags=["planos"])


@router.post("", response_model=PlanoOut, status_code=201)
def cadastrar_plano(
    payload: PlanoCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Plano:
    plano = Plano(point_id=admin.point_id, **payload.model_dump())
    db.add(plano)
    db.commit()
    db.refresh(plano)
    return plano


@router.get("", response_model=list[PlanoOut])
def listar_planos(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
) -> list[Plano]:
    """Qualquer usuário autenticado pode ver — o admin usa pra escolher o
    plano na hora de ativar uma assinatura."""
    return db.query(Plano).filter(Plano.point_id == point_id).order_by(Plano.frequencia_semanal).all()


@router.patch("/{plano_id}", response_model=PlanoOut)
def atualizar_plano(
    plano_id: int,
    payload: PlanoUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Plano:
    """Ajustar o preço de um plano já cadastrado (pedido do usuário,
    2026-09-01: "quadras e planos também da mesma forma")."""
    plano = db.get(Plano, plano_id)
    if plano is None or plano.point_id != admin.point_id:
        raise HTTPException(404, "Plano não encontrado")

    for campo, valor in payload.model_dump(exclude_none=True).items():
        setattr(plano, campo, valor)

    db.commit()
    db.refresh(plano)
    return plano


@router.delete("/{plano_id}", status_code=204)
def remover_plano(
    plano_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Remover plano (pedido do usuário, 2026-09-01) — bloqueia se já foi
    usado numa assinatura ou num convite (aceito ou pendente), já que as
    FKs de Assinatura.plano_id/Convite.plano_id pra Plano não têm cascade."""
    plano = db.get(Plano, plano_id)
    if plano is None or plano.point_id != admin.point_id:
        raise HTTPException(404, "Plano não encontrado")

    tem_assinatura = db.query(Assinatura.id).filter(Assinatura.plano_id == plano_id).first() is not None
    if tem_assinatura:
        raise HTTPException(409, "Esse plano já foi usado numa assinatura — não dá pra remover.")

    tem_convite = db.query(Convite.id).filter(Convite.plano_id == plano_id).first() is not None
    if tem_convite:
        raise HTTPException(409, "Esse plano já foi usado num convite — não dá pra remover.")

    db.delete(plano)
    db.commit()
