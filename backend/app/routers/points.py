from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.enums import Role
from app.models.point import Point
from app.models.user import User
from app.schemas.point import AdminPointCreate, PointCreate, PointOut
from app.schemas.auth import UserOut

router = APIRouter(prefix="/points", tags=["points"])


@router.post("", response_model=PointOut, status_code=201)
def criar_point(
    payload: PointCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> Point:
    # formas_pagamento_habilitadas nasce vazio de propósito: só o dono do app
    # habilita, em uma ação separada (seção 4.1) — nunca no cadastro em si.
    point = Point(**payload.model_dump(), formas_pagamento_habilitadas=[])
    db.add(point)
    db.commit()
    db.refresh(point)
    return point


@router.get("", response_model=list[PointOut])
def listar_points(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> list[Point]:
    return db.query(Point).all()


@router.patch("/{point_id}/formas-pagamento", response_model=PointOut)
def atualizar_formas_pagamento(
    point_id: int,
    formas: list[str],
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> Point:
    point = db.get(Point, point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")

    point.formas_pagamento_habilitadas = formas
    db.commit()
    db.refresh(point)
    return point


@router.post("/{point_id}/admins", response_model=UserOut, status_code=201)
def convidar_admin_do_point(
    point_id: int,
    payload: AdminPointCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> User:
    """Cria a conta de admin de um Point. Só o dono do app pode convidar —
    não há autocadastro de admin_point (ele gerencia dados de terceiros)."""
    if db.get(Point, point_id) is None:
        raise HTTPException(404, "Point não encontrado")
    if db.query(User).filter(User.celular == payload.celular).first():
        raise HTTPException(409, "Já existe uma conta com este celular")

    admin = User(
        nome=payload.nome,
        celular=payload.celular,
        email=payload.email,
        senha_hash=hash_password(payload.senha),
        role=Role.ADMIN_POINT,
        point_id=point_id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
