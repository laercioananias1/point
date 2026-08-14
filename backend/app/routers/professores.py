from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.enums import Role
from app.models.professor import Professor
from app.models.user import User
from app.schemas.professor import ProfessorCreate, ProfessorOut

router = APIRouter(prefix="/professores", tags=["professores"])


@router.post("", response_model=ProfessorOut, status_code=201)
def cadastrar_professor(payload: ProfessorCreate, db: Annotated[Session, Depends(get_db)]) -> Professor:
    """Cadastro público — o professor é uma entidade global, sem convite obrigatório
    (o vínculo com um Point específico vem depois, via POST /vinculos)."""
    if db.query(User).filter(User.celular == payload.contato).first():
        raise HTTPException(409, "Já existe uma conta com este celular")

    professor = Professor(
        nome=payload.nome,
        contato=payload.contato,
        email=payload.email,
        modalidades=payload.modalidades,
    )
    db.add(professor)
    db.flush()  # garante professor.id antes de criar o User

    user = User(
        nome=payload.nome,
        celular=payload.contato,
        email=payload.email,
        senha_hash=hash_password(payload.senha),
        role=Role.PROFESSOR,
        professor_id=professor.id,
    )
    db.add(user)
    db.commit()
    db.refresh(professor)
    return professor


@router.get("/me", response_model=ProfessorOut)
def meu_perfil(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> Professor:
    return db.get(Professor, user.professor_id)
