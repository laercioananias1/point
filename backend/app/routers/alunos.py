from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.aluno import Aluno
from app.models.aluno_categoria import AlunoCategoria
from app.models.assinatura import Assinatura
from app.models.categoria import Categoria
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import Role
from app.models.matricula import Matricula
from app.models.user import User
from app.schemas.aluno import AlunoCreate, AlunoOut
from app.schemas.aluno_categoria import AlunoCategoriaOut, AlunoCategoriaSet
from app.schemas.assinatura import AssinaturaOut
from app.schemas.credito import CreditoOut
from app.schemas.matricula import MatriculaOut

router = APIRouter(prefix="/alunos", tags=["alunos"])


@router.post("", response_model=AlunoOut, status_code=201)
def cadastrar_aluno(payload: AlunoCreate, db: Annotated[Session, Depends(get_db)]) -> Aluno:
    # Só e-mail precisa ser único — é o login de todo mundo (pedido do
    # usuário, 2026-08-21); celular pode repetir.
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Já existe uma conta com este e-mail")

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
        roles=[Role.ALUNO.value],
        aluno_id=aluno.id,
    )
    db.add(user)
    db.commit()
    db.refresh(aluno)
    return aluno


@router.get("", response_model=list[AlunoOut])
def buscar_alunos(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    busca: str = "",
) -> list[Aluno]:
    """Busca de aluno já cadastrado, por nome ou contato — pro admin achar
    rápido ao montar uma assinatura (pedido do usuário, 2026-08-20: o
    cadastro de assinatura passou a ser só do admin, então ele precisa de
    um jeito de achar um aluno que já existe na plataforma)."""
    query = db.query(Aluno)
    if busca:
        termo = f"%{busca}%"
        query = query.filter(or_(Aluno.nome.ilike(termo), Aluno.contato.ilike(termo)))
    return query.order_by(Aluno.nome).limit(20).all()


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


@router.get("/{aluno_id}/categoria", response_model=AlunoCategoriaOut | None)
def obter_categoria_do_aluno(
    aluno_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> AlunoCategoria | None:
    """Nível/categoria desse aluno NESTE Point (pedido do usuário,
    2026-09-08) — Aluno é global, então a classificação é por aluno+Point
    (ver AlunoCategoria.__doc__), não um campo direto no Aluno."""
    return (
        db.query(AlunoCategoria)
        .filter(AlunoCategoria.aluno_id == aluno_id, AlunoCategoria.point_id == admin.point_id)
        .first()
    )


@router.patch("/{aluno_id}/categoria", response_model=AlunoCategoriaOut)
def definir_categoria_do_aluno(
    aluno_id: int,
    payload: AlunoCategoriaSet,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> AlunoCategoria:
    """Classifica (ou reclassifica) o aluno num nível deste Point — upsert
    por aluno+Point (pedido do usuário, 2026-09-08: só a capacidade de
    classificar por enquanto, sem validar contra a turma ainda)."""
    aluno = db.get(Aluno, aluno_id)
    if aluno is None:
        raise HTTPException(404, "Aluno não encontrado")

    categoria = db.get(Categoria, payload.categoria_id)
    if categoria is None or categoria.point_id != admin.point_id:
        raise HTTPException(404, "Categoria não encontrada neste Point")

    vinculo_existente = (
        db.query(AlunoCategoria)
        .filter(AlunoCategoria.aluno_id == aluno_id, AlunoCategoria.point_id == admin.point_id)
        .first()
    )
    if vinculo_existente:
        vinculo_existente.categoria_id = categoria.id
        db.commit()
        db.refresh(vinculo_existente)
        return vinculo_existente

    novo = AlunoCategoria(aluno_id=aluno_id, point_id=admin.point_id, categoria_id=categoria.id)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo
