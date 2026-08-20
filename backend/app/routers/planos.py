from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.plano import Plano
from app.models.user import User
from app.schemas.plano import PlanoCreate, PlanoOut

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
