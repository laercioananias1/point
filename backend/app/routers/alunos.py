from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import Role
from app.models.matricula import Matricula
from app.models.user import User
from app.schemas.aluno import AlunoCreate, AlunoOut
from app.schemas.assinatura import AssinaturaOut
from app.schemas.credito import CreditoOut
from app.schemas.matricula import MatriculaOut

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


@router.get("/me/matriculas", response_model=list[MatriculaOut])
def minhas_matriculas(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> list[Matricula]:
    """Agenda do aluno — em qualquer Point/professor (seção 2), independente
    de status, pra ele acompanhar tanto o que já está ativo quanto o que
    ainda está em análise."""
    return db.query(Matricula).filter(Matricula.aluno_id == user.aluno_id).all()


@router.get("/me/creditos", response_model=list[CreditoOut])
def meus_creditos(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> list[CreditoReposicao]:
    """Créditos de reposição do aluno, em qualquer status (seção 4.4) — pra
    ele ver tanto o que ainda pode usar quanto o histórico."""
    # join explícito: CreditoReposicao tem duas FKs pra matriculas
    # (matricula_id e nova_matricula_id) — sem isso o SQLAlchemy não sabe
    # qual usar e recusa a query (AmbiguousForeignKeysError).
    return (
        db.query(CreditoReposicao)
        .join(Matricula, CreditoReposicao.matricula_id == Matricula.id)
        .filter(Matricula.aluno_id == user.aluno_id)
        .all()
    )


@router.get("/me/assinaturas", response_model=list[AssinaturaOut])
def minhas_assinaturas(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> list[Assinatura]:
    return db.query(Assinatura).filter(Assinatura.aluno_id == user.aluno_id).all()
