from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.modalidade import Modalidade
from app.models.user import User
from app.schemas.modalidade import ModalidadeCreate, ModalidadeOut

router = APIRouter(prefix="/modalidades", tags=["modalidades"])


@router.post("", response_model=ModalidadeOut, status_code=201)
def cadastrar_modalidade(
    payload: ModalidadeCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Modalidade:
    """Cadastro de modalidade do Point (seção 4.1) — só o admin do Point."""
    modalidade = Modalidade(point_id=admin.point_id, **payload.model_dump())
    db.add(modalidade)
    db.commit()
    db.refresh(modalidade)
    return modalidade


@router.get("", response_model=list[ModalidadeOut])
def listar_modalidades(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
) -> list[Modalidade]:
    """Qualquer usuário autenticado pode ver — o professor precisa disso pra
    escolher a modalidade ao criar uma turma."""
    return db.query(Modalidade).filter(Modalidade.point_id == point_id).all()
