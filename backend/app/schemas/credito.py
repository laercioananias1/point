from datetime import date

from app.models.enums import CreditoMotivo, CreditoStatus
from app.schemas.common import ORMModel


class ReagendarCredito(ORMModel):
    turma_id: int
    # Dia específico escolhido pelo aluno no calendário (pedido do usuário,
    # 2026-08-25) — precisa bater com um dia_semana da turma e não pode
    # colidir com outra aula que o aluno já tenha nesse horário.
    data_aula: date


class CreditoOut(ORMModel):
    id: int
    matricula_id: int
    motivo: CreditoMotivo
    data_aula: date
    data_expiracao: date
    status: CreditoStatus
    nova_matricula_id: int | None
    # Pedido do usuário, 2026-08-25: reagendamento fica restrito ao mesmo
    # professor que já dá aula pro aluno — o frontend usa isso pra já
    # buscar só as turmas desse professor.
    professor_id: int
    professor_nome: str
    modalidade_nome: str
