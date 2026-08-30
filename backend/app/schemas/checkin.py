from datetime import date, datetime

from app.models.enums import CheckinOrigem, CheckinStatus
from app.schemas.common import ORMModel


class TotalPassCheckinCreate(ORMModel):
    turma_id: int
    # Código/token do dia que o aluno TotalPass mostra na recepção (pedido
    # do usuário, 2026-08-25) — digitado na hora pelo professor ou admin.
    codigo: str


class PresencaMarcar(ORMModel):
    """Presença de um aluno matriculado numa data específica (pedido do
    usuário, 2026-08-26: "um check pra marcar presença de cada um") —
    diferente do check-in TotalPass, esse sempre tem matrícula por trás."""

    turma_id: int
    matricula_id: int
    data: date


class CheckinOut(ORMModel):
    id: int
    turma_id: int
    matricula_id: int | None
    aluno_nome: str | None
    data_hora: datetime
    origem: CheckinOrigem
    status: CheckinStatus
    beneficiario_nome: str | None
    beneficiario_documento: str | None
