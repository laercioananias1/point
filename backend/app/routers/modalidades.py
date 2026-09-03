from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.matricula import Matricula
from app.models.modalidade import Modalidade
from app.models.turma import Turma
from app.models.user import User
from app.schemas.modalidade import ModalidadeCreate, ModalidadeOut, ModalidadeUpdate

router = APIRouter(prefix="/modalidades", tags=["modalidades"])


@router.post("", response_model=ModalidadeOut, status_code=201)
def cadastrar_modalidade(
    payload: ModalidadeCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Modalidade:
    """Cadastro de modalidade do Point (seção 4.1) — só o admin do Point."""
    modalidade = Modalidade(point_id=admin.point_id, **payload.model_dump())
    db.add(modalidade)
    db.commit()
    db.refresh(modalidade)
    return modalidade


@router.get("", response_model=list[ModalidadeOut])
def listar_modalidades(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
) -> list[Modalidade]:
    """Qualquer usuário autenticado pode ver — o professor precisa disso pra
    escolher a modalidade ao criar uma turma."""
    return db.query(Modalidade).filter(Modalidade.point_id == point_id).all()


@router.patch("/{modalidade_id}", response_model=ModalidadeOut)
def atualizar_modalidade(
    modalidade_id: int,
    payload: ModalidadeUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Modalidade:
    """Ajustar nome/duração/preço da tabela do Point (pedido do usuário,
    2026-08-21) — preço de aula avulsa vive aqui, não no vínculo."""
    modalidade = db.get(Modalidade, modalidade_id)
    if modalidade is None or modalidade.point_id != admin.point_id:
        raise HTTPException(404, "Modalidade não encontrada")

    for campo, valor in payload.model_dump(exclude_none=True).items():
        setattr(modalidade, campo, valor)

    db.commit()
    db.refresh(modalidade)
    return modalidade


@router.delete("/{modalidade_id}", status_code=204)
def remover_modalidade(
    modalidade_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Remover modalidade (pedido do usuário, 2026-09-01: "é preciso
    permitir alterar o nome e remover caso necessário. Validar para
    remover, verificar se já não existe aplicada em alguma matrícula").

    Turma é quem de fato prende matrícula numa modalidade
    (Matricula.turma_id -> Turma.modalidade_id) e a FK de Turma pra
    Modalidade não tem cascade — bloqueia se tiver qualquer turma, com
    mensagem diferente se já tem aluno matriculado ou é só turma vazia."""
    modalidade = db.get(Modalidade, modalidade_id)
    if modalidade is None or modalidade.point_id != admin.point_id:
        raise HTTPException(404, "Modalidade não encontrada")

    turma_ids = [t.id for t in db.query(Turma.id).filter(Turma.modalidade_id == modalidade_id).all()]
    if turma_ids:
        tem_matricula = (
            db.query(Matricula.id).filter(Matricula.turma_id.in_(turma_ids)).first() is not None
        )
        if tem_matricula:
            raise HTTPException(409, "Essa modalidade já tem aluno matriculado — não dá pra remover.")
        raise HTTPException(
            409,
            "Essa modalidade tem turma cadastrada — remova as turmas antes de remover a modalidade.",
        )

    db.delete(modalidade)
    db.commit()
