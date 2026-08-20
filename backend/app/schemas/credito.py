from datetime import date

from app.models.enums import CreditoMotivo, CreditoStatus
from app.schemas.common import ORMModel


class CancelamentoAula(ORMModel):
    data_aula: date


class ReagendarCredito(ORMModel):
    turma_id: int


class CreditoOut(ORMModel):
    id: int
    matricula_id: int
    motivo: CreditoMotivo
    data_aula: date
    data_expiracao: date
    status: CreditoStatus
    nova_matricula_id: int | None
