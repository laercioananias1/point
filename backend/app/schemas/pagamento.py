from datetime import date
from typing import Literal

from app.models.enums import PagamentoMeio, PagamentoStatus
from app.schemas.common import ORMModel


class PagamentoCreate(ORMModel):
    matricula_id: int
    valor: float
    meio: PagamentoMeio


class AulaCobertaOut(ORMModel):
    """Uma data do extrato de um pagamento (pedido do usuário, 2026-08-21:
    "o pagamento X refere-se às aulas xyz?")."""

    data: date
    status: Literal["realizada", "agendada", "cancelada"]


class PagamentoResumo(ORMModel):
    """Usado dentro de MatriculaOut — a própria matrícula já dá o contexto
    de aluno/turma, então aqui basta o essencial do pagamento em si."""

    id: int
    valor: float
    meio: PagamentoMeio
    status: PagamentoStatus
    registrado_por_id: int | None
    # Mês que esse pagamento cobre — só matrícula mensal usa isso (pedido do
    # usuário, 2026-08-21); avulsa fica None.
    mes_referencia: date | None
    # Extrato: as aulas do mês cobertas por este pagamento (pedido do
    # usuário, 2026-08-21) — vazio pra avulsa (a matrícula já é a reserva
    # única, sem mês nem lista de datas).
    aulas_cobertas: list[AulaCobertaOut] = []


class PagamentoOut(PagamentoResumo):
    """Resposta do router de pagamentos — de propósito NÃO aninha MatriculaOut
    (que aninha PagamentoResumo) para não criar um ciclo de schema; o contexto
    de aluno/turma vem denormalizado nestes dois campos."""

    matricula_id: int
    aluno_nome: str
    turma_modalidade: str
