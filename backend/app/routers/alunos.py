from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.aluno import Aluno
from app.models.enums import Role
from app.models.user import User
from app.schemas.aluno import AlunoCreate, AlunoOut

router = APIRouter(prefix="/alunos", tags=["alunos"])


@router.post("", response_model=AlunoOut, status_code=201)
def cadastrar_aluno(payload: AlunoCreate, db: Annotated[Session, Depends(get_db)]) -> Aluno:
    if db.query(User).filter(User.celular == payload.contato).first():
        raise HTTPException(409, "Já existe uma conta com este celular")

    aluno = Aluno(
        nome=payload.nome,
        contato=payload.contato,
        email=payload.email,
        forma_pagamento_preferida=payload.forma_pagamento_preferida,
    )
    db.add(aluno)
    db.flush()

    user = User(
        nome=payload.nome,
        celular=payload.contato,
        email=payload.email,
        senha_hash=hash_password(payload.senha),
        role=Role.ALUNO,
        aluno_id=aluno.id,
    )
    db.add(user)
    db.commit()
    db.refresh(aluno)
    return aluno


@router.get("/me", response_model=AlunoOut)
def meu_perfil(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Aluno:
    return db.get(Aluno, user.aluno_id)
