from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import MatriculaStatus, Role
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.matricula import MatriculaCreate, MatriculaOut

router = APIRouter(prefix="/matriculas", tags=["matriculas"])


def _get_matricula_do_point_do_admin(db: Session, matricula_id: int, admin: User) -> Matricula:
    matricula = (
        db.query(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Matricula.id == matricula_id, Vinculo.point_id == admin.point_id)
        .first()
    )
    if matricula is None:
        raise HTTPException(404, "Matrícula não encontrada")
    return matricula


@router.post("", response_model=MatriculaOut, status_code=201)
def solicitar_matricula(
    payload: MatriculaCreate,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Matricula:
    """Toda matrícula nova nasce 'em_analise' — não existe matrícula automática
    (seção 4.2). A reserva de vaga em tempo real durante a análise é responsabilidade
    de uma etapa futura (controle de capacidade da Turma), fora deste scaffold."""
    turma = db.get(Turma, payload.turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")

    matricula = Matricula(
        aluno_id=aluno.aluno_id,
        status=MatriculaStatus.EM_ANALISE,
        **payload.model_dump(),
    )
    db.add(matricula)
    db.commit()
    db.refresh(matricula)
    return matricula


@router.get("", response_model=list[MatriculaOut])
def listar_matriculas_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Matricula]:
    return (
        db.query(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Vinculo.point_id == admin.point_id)
        .all()
    )


@router.patch("/{matricula_id}/aprovar", response_model=MatriculaOut)
def aprovar_matricula(
    matricula_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Matricula:
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    matricula.status = MatriculaStatus.ATIVA
    db.commit()
    db.refresh(matricula)
    return matricula


@router.patch("/{matricula_id}/recusar", response_model=MatriculaOut)
def recusar_matricula(
    matricula_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Matricula:
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    matricula.status = MatriculaStatus.RECUSADA
    db.commit()
    db.refresh(matricula)
    return matricula
