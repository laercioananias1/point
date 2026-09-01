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
from app.models.vinculo import Vinculo
from app.schemas.credito import ReagendarCredito
from app.schemas.matricula import MatriculaOut
from app.services.aulas import DIAS_SEMANA, aluno_tem_conflito_horario

router = APIRouter(prefix="/creditos", tags=["creditos"])


def _reagendar_credito(db: Session, credito: CreditoReposicao, payload: ReagendarCredito) -> Matricula:
    """Núcleo compartilhado de usar um crédito de reposição pra entrar numa
    turma com vaga (seção 4.4) — usado tanto pelo aluno reagendando a
    própria aula quanto pelo admin fazendo isso por ele (pedido do usuário,
    2026-09-01: "fazer ajustes na agenda do aluno", ver reagendar_credito_
    admin abaixo). Não passa por aprovação do admin (a matrícula original
    já foi aprovada; isso só reagenda uma aula que já era devida)."""
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

    # Pedido do usuário, 2026-08-25: "ele só pode reagendar com o professor
    # que já dá aula pra ele" — não vale usar o crédito numa turma de outro
    # professor (mesmo Point ou não).
    if nova_turma.vinculo.professor_id != credito.professor_id:
        raise HTTPException(
            422, "Esse crédito só pode ser usado numa turma do mesmo professor da aula original"
        )

    data_aula = payload.data_aula
    if data_aula < date.today():
        raise HTTPException(422, "Escolha uma data futura")
    if DIAS_SEMANA[data_aula.weekday()] not in nova_turma.dias_semana:
        raise HTTPException(422, "Essa turma não tem aula nesse dia da semana")
    if data_aula < nova_turma.periodo_inicio or (
        nova_turma.periodo_fim is not None and data_aula > nova_turma.periodo_fim
    ):
        raise HTTPException(422, "Essa data está fora do período dessa turma")
    if data_aula in nova_turma.excecoes:
        raise HTTPException(422, "Essa data foi cancelada nessa turma")

    aluno_id = credito.matricula.aluno_id
    if aluno_tem_conflito_horario(
        db,
        aluno_id=aluno_id,
        data=data_aula,
        horario=nova_turma.horario,
        duracao_minutos=nova_turma.duracao_minutos,
    ):
        raise HTTPException(409, "Já existe aula nesse horário nesse dia pra esse aluno")

    nova_matricula = Matricula(
        aluno_id=aluno_id,
        turma_id=nova_turma.id,
        tipo=MatriculaTipo.AVULSA,
        status=MatriculaStatus.ATIVA,
        fonte_pagamento=credito.matricula.fonte_pagamento,
        data_avulsa=data_aula,
    )
    db.add(nova_matricula)
    db.flush()  # garante nova_matricula.id antes de linkar no crédito

    credito.status = CreditoStatus.USADO
    credito.nova_matricula_id = nova_matricula.id
    return nova_matricula


@router.post("/{credito_id}/reagendar", response_model=MatriculaOut, status_code=201)
def reagendar_credito(
    credito_id: int,
    payload: ReagendarCredito,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Matricula:
    """O aluno escolhe turma + data específica no calendário (pedido do
    usuário, 2026-08-25: "o aluno precisa ver no calendário qual dia e hora
    que ele quer reagendar" — antes só escolhia a turma numa lista e a data
    virava sempre turma.periodo_inicio, sem relação nenhuma com o que o
    aluno queria). A data tem que ser uma ocorrência de verdade da turma
    (dia da semana batendo, dentro do período, não cancelada) e não pode
    colidir com outra aula que o aluno já tenha nesse horário."""
    credito = db.get(CreditoReposicao, credito_id)
    if credito is None or credito.matricula.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Crédito não encontrado")

    nova_matricula = _reagendar_credito(db, credito, payload)
    db.commit()
    db.refresh(nova_matricula)
    return nova_matricula


@router.post("/{credito_id}/reagendar-admin", response_model=MatriculaOut, status_code=201)
def reagendar_credito_admin(
    credito_id: int,
    payload: ReagendarCredito,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Matricula:
    """Admin reagendando o crédito de um aluno do próprio Point (pedido do
    usuário, 2026-09-01: "fazer ajustes na agenda do aluno") — mesmas
    regras de reagendar_credito, só a dona do crédito muda: em vez de "o
    aluno logado", é "qualquer aluno de uma matrícula do Point do admin"."""
    credito = (
        db.query(CreditoReposicao)
        .join(Matricula, CreditoReposicao.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(CreditoReposicao.id == credito_id, Vinculo.point_id == admin.point_id)
        .first()
    )
    if credito is None:
        raise HTTPException(404, "Crédito não encontrado")

    nova_matricula = _reagendar_credito(db, credito, payload)
    db.commit()
    db.refresh(nova_matricula)
    return nova_matricula
