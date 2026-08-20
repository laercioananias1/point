from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import CreditoStatus, MatriculaStatus, MatriculaTipo, Role, VinculoStatus
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.schemas.credito import ReagendarCredito
from app.schemas.matricula import MatriculaOut

router = APIRouter(prefix="/creditos", tags=["creditos"])


@router.post("/{credito_id}/reagendar", response_model=MatriculaOut, status_code=201)
def reagendar_credito(
    credito_id: int,
    payload: ReagendarCredito,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Matricula:
    """Usa um crédito de reposição pra entrar numa turma com vaga (seção 4.4)
    — não passa por aprovação do admin (a matrícula original já foi aprovada;
    isso só reagenda uma aula que já era devida). A checagem de vaga
    disponível fica pra uma etapa futura (controle de capacidade da Turma)."""
    credito = db.get(CreditoReposicao, credito_id)
    if credito is None or credito.matricula.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Crédito não encontrado")

    if credito.status == CreditoStatus.DISPONIVEL and credito.data_expiracao < date.today():
        # Expiração é checada aqui (lazy), não por um job — atualiza o status
        # pra refletir a realidade antes de recusar o reagendamento.
        credito.status = CreditoStatus.EXPIRADO
        db.commit()

    if credito.status != CreditoStatus.DISPONIVEL:
        raise HTTPException(422, f"Este crédito está '{credito.status.value}', não disponível")

    nova_turma = db.get(Turma, payload.turma_id)
    if nova_turma is None or nova_turma.vinculo.status != VinculoStatus.ATIVO:
        raise HTTPException(404, "Turma não encontrada")

    nova_matricula = Matricula(
        aluno_id=aluno.aluno_id,
        turma_id=nova_turma.id,
        tipo=MatriculaTipo.AVULSA,
        status=MatriculaStatus.ATIVA,
        fonte_pagamento=credito.matricula.fonte_pagamento,
    )
    db.add(nova_matricula)
    db.flush()  # garante nova_matricula.id antes de linkar no crédito

    credito.status = CreditoStatus.USADO
    credito.nova_matricula_id = nova_matricula.id

    db.commit()
    db.refresh(nova_matricula)
    return nova_matricula
