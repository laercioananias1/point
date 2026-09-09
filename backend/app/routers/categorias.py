from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.categoria import Categoria
from app.models.enums import Role
from app.models.turma import Turma
from app.models.user import User
from app.schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.post("", response_model=CategoriaOut, status_code=201)
def cadastrar_categoria(
    payload: CategoriaCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Categoria:
    """Cadastro de nível/categoria do Point (pedido do usuário, 2026-09-08)
    — ex.: 'Iniciante', 'Intermediário', 'Avançado' — só o admin do Point."""
    categoria = Categoria(point_id=admin.point_id, **payload.model_dump())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.get("", response_model=list[CategoriaOut])
def listar_categorias(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
) -> list[Categoria]:
    """Qualquer usuário autenticado pode ver — o professor precisa disso pra
    escolher a categoria ao criar uma turma."""
    return db.query(Categoria).filter(Categoria.point_id == point_id).all()


@router.patch("/{categoria_id}", response_model=CategoriaOut)
def atualizar_categoria(
    categoria_id: int,
    payload: CategoriaUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None or categoria.point_id != admin.point_id:
        raise HTTPException(404, "Categoria não encontrada")

    for campo, valor in payload.model_dump(exclude_none=True).items():
        setattr(categoria, campo, valor)

    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete("/{categoria_id}", status_code=204)
def remover_categoria(
    categoria_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Bloqueia a remoção se alguma turma ainda usa essa categoria (turma é
    exclusiva de uma categoria e a FK não tem cascade) — mesmo padrão de
    remover_modalidade em routers/modalidades.py."""
    categoria = db.get(Categoria, categoria_id)
    if categoria is None or categoria.point_id != admin.point_id:
        raise HTTPException(404, "Categoria não encontrada")

    tem_turma = db.query(Turma.id).filter(Turma.categoria_id == categoria_id).first() is not None
    if tem_turma:
        raise HTTPException(
            409, "Essa categoria tem turma cadastrada — remova ou troque a categoria das turmas antes."
        )

    db.delete(categoria)
    db.commit()
