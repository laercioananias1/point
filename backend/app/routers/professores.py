from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.enums import Role
from app.models.matricula import Matricula
from app.models.professor import Professor
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.matricula import MatriculaOut
from app.schemas.professor import ProfessorCreate, ProfessorOut
from app.schemas.vinculo import VinculoOut

router = APIRouter(prefix="/professores", tags=["professores"])


@router.get("", response_model=list[ProfessorOut])
def buscar_professores(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    busca: str = "",
) -> list[Professor]:
    """Busca de professor já cadastrado na plataforma, por nome ou contato —
    pro admin achar o celular/e-mail certos antes de convidar pro seu Point
    (pedido do usuário, 2026-08-21: "e se eu já tenho um professor na
    plataforma e quero convidá-lo?" — o convite exige o contato exato de
    quem já tem conta, essa busca evita o admin ter que adivinhar)."""
    query = db.query(Professor)
    if busca:
        termo = f"%{busca}%"
        query = query.filter(or_(Professor.nome.ilike(termo), Professor.contato.ilike(termo)))
    return query.order_by(Professor.nome).limit(20).all()


@router.post("", response_model=ProfessorOut, status_code=201)
def cadastrar_professor(payload: ProfessorCreate, db: Annotated[Session, Depends(get_db)]) -> Professor:
    """Cadastro público — o professor é uma entidade global. O vínculo com
    um Point específico não é mais solicitado por aqui (pedido do usuário,
    2026-08-21): o admin do Point convida via ConviteVinculo, que já cria
    o vínculo e a conta do professor juntos, se ele ainda não tiver uma."""
    # Só e-mail precisa ser único — é o login de todo mundo (pedido do
    # usuário, 2026-08-21); celular pode repetir.
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Já existe uma conta com este e-mail")

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
        roles=[Role.PROFESSOR.value],
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


@router.get("/me/vinculos", response_model=list[VinculoOut])
def meus_vinculos(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> list[Vinculo]:
    """Todos os vínculos do professor, em qualquer status e em qualquer Point
    (seção 3.1 — visão consolidada, não fica restrita a um Point selecionado)."""
    return db.query(Vinculo).filter(Vinculo.professor_id == user.professor_id).all()


@router.get("/me/matriculas", response_model=list[MatriculaOut])
def minhas_matriculas(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> list[Matricula]:
    """Matrículas de todas as turmas do professor, em qualquer Point — usado
    pra acompanhar o status de pagamento de cada aluno (aba Turmas)."""
    return (
        db.query(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Vinculo.professor_id == user.professor_id)
        .all()
    )
