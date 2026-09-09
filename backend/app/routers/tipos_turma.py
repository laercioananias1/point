from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.tipo_turma import TipoTurma
from app.models.turma import Turma
from app.models.user import User
from app.schemas.tipo_turma import TipoTurmaCreate, TipoTurmaOut, TipoTurmaUpdate

router = APIRouter(prefix="/tipos-turma", tags=["tipos-turma"])


@router.post("", response_model=TipoTurmaOut, status_code=201)
def cadastrar_tipo_turma(
    payload: TipoTurmaCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> TipoTurma:
    """Cadastro de tipo/formato de turma do Point (pedido do usuário,
    2026-09-09) — ex.: 'Padrão', 'Aula individual', 'Dupla', 'Família' — só
    o admin do Point."""
    tipo = TipoTurma(point_id=admin.point_id, **payload.model_dump())
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


@router.get("", response_model=list[TipoTurmaOut])
def listar_tipos_turma(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
) -> list[TipoTurma]:
    """Qualquer usuário autenticado pode ver — o professor precisa disso
    pra escolher o tipo ao criar uma turma."""
    return db.query(TipoTurma).filter(TipoTurma.point_id == point_id).all()


@router.patch("/{tipo_turma_id}", response_model=TipoTurmaOut)
def atualizar_tipo_turma(
    tipo_turma_id: int,
    payload: TipoTurmaUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> TipoTurma:
    tipo = db.get(TipoTurma, tipo_turma_id)
    if tipo is None or tipo.point_id != admin.point_id:
        raise HTTPException(404, "Tipo de turma não encontrado")

    for campo, valor in payload.model_dump(exclude_none=True).items():
        setattr(tipo, campo, valor)

    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete("/{tipo_turma_id}", status_code=204)
def remover_tipo_turma(
    tipo_turma_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Bloqueia a remoção se alguma turma ainda usa esse tipo — mesmo
    padrão de remover_categoria em routers/categorias.py."""
    tipo = db.get(TipoTurma, tipo_turma_id)
    if tipo is None or tipo.point_id != admin.point_id:
        raise HTTPException(404, "Tipo de turma não encontrado")

    tem_turma = db.query(Turma.id).filter(Turma.tipo_turma_id == tipo_turma_id).first() is not None
    if tem_turma:
        raise HTTPException(
            409, "Esse tipo de turma tem turma cadastrada — troque o tipo delas antes de remover."
        )

    db.delete(tipo)
    db.commit()
