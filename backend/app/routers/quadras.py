from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.modalidade import Modalidade
from app.models.quadra import Quadra
from app.models.user import User
from app.schemas.quadra import QuadraCreate, QuadraOut, QuadraUpdate

router = APIRouter(prefix="/quadras", tags=["quadras"])


def _modalidades_do_point(db: Session, ids: list[int], point_id: int) -> list[Modalidade]:
    if not ids:
        return []
    modalidades = db.query(Modalidade).filter(Modalidade.id.in_(ids), Modalidade.point_id == point_id).all()
    if len(modalidades) != len(set(ids)):
        raise HTTPException(422, "Alguma modalidade não pertence ao seu Point")
    return modalidades


@router.post("", response_model=QuadraOut, status_code=201)
def cadastrar_quadra(
    payload: QuadraCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Quadra:
    """Cadastro de quadra do Point (seção 4.1) — já associando quais
    modalidades ela atende (uma quadra costuma atender mais de uma)."""
    quadra = Quadra(
        point_id=admin.point_id,
        nome=payload.nome,
        modalidades=_modalidades_do_point(db, payload.modalidade_ids, admin.point_id),
    )
    db.add(quadra)
    db.commit()
    db.refresh(quadra)
    return quadra


@router.get("", response_model=list[QuadraOut])
def listar_quadras(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
    modalidade_id: int | None = None,
) -> list[Quadra]:
    """modalidade_id filtra só as quadras disponíveis pra aquela modalidade —
    é o que a tela de criar turma usa depois de escolher a modalidade."""
    query = db.query(Quadra).filter(Quadra.point_id == point_id)
    if modalidade_id:
        query = query.join(Quadra.modalidades).filter(Modalidade.id == modalidade_id)
    return query.all()


@router.patch("/{quadra_id}", response_model=QuadraOut)
def atualizar_quadra(
    quadra_id: int,
    payload: QuadraUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Quadra:
    quadra = db.get(Quadra, quadra_id)
    if quadra is None or quadra.point_id != admin.point_id:
        raise HTTPException(404, "Quadra não encontrada")

    if payload.nome is not None:
        quadra.nome = payload.nome
    if payload.modalidade_ids is not None:
        quadra.modalidades = _modalidades_do_point(db, payload.modalidade_ids, admin.point_id)

    db.commit()
    db.refresh(quadra)
    return quadra
