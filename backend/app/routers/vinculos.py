from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import Role, VinculoStatus
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.vinculo import VinculoAprovacao, VinculoCreate, VinculoOut

router = APIRouter(prefix="/vinculos", tags=["vinculos"])


def _get_vinculo_do_point_do_admin(db: Session, vinculo_id: int, admin: User) -> Vinculo:
    """Isolamento entre Points (seção 3.1): o admin só enxerga vínculos do seu Point."""
    vinculo = db.get(Vinculo, vinculo_id)
    if vinculo is None or vinculo.point_id != admin.point_id:
        raise HTTPException(404, "Vínculo não encontrado")
    return vinculo


@router.post("", response_model=VinculoOut, status_code=201)
def solicitar_vinculo(
    payload: VinculoCreate,
    db: Annotated[Session, Depends(get_db)],
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> Vinculo:
    vinculo = Vinculo(
        professor_id=professor.professor_id,
        status=VinculoStatus.PENDENTE,
        **payload.model_dump(),
    )
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    return vinculo


@router.get("", response_model=list[VinculoOut])
def listar_vinculos_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Vinculo]:
    return db.query(Vinculo).filter(Vinculo.point_id == admin.point_id).all()


@router.patch("/{vinculo_id}/aprovar", response_model=VinculoOut)
def aprovar_vinculo(
    vinculo_id: int,
    payload: VinculoAprovacao,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Vinculo:
    vinculo = _get_vinculo_do_point_do_admin(db, vinculo_id, admin)

    for campo, valor in payload.model_dump(exclude_none=True).items():
        setattr(vinculo, campo, valor)
    vinculo.status = VinculoStatus.ATIVO

    db.commit()
    db.refresh(vinculo)
    return vinculo


@router.patch("/{vinculo_id}/recusar", response_model=VinculoOut)
def recusar_vinculo(
    vinculo_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Vinculo:
    vinculo = _get_vinculo_do_point_do_admin(db, vinculo_id, admin)
    vinculo.status = VinculoStatus.RECUSADO
    db.commit()
    db.refresh(vinculo)
    return vinculo
