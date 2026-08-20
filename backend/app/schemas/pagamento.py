from app.models.enums import PagamentoMeio, PagamentoStatus
from app.schemas.common import ORMModel


class PagamentoCreate(ORMModel):
    matricula_id: int
    valor: float
    meio: PagamentoMeio


class PagamentoResumo(ORMModel):
    """Usado dentro de MatriculaOut — a própria matrícula já dá o contexto
    de aluno/turma, então aqui basta o essencial do pagamento em si."""

    id: int
    valor: float
    meio: PagamentoMeio
    status: PagamentoStatus
    registrado_por_id: int | None


class PagamentoOut(PagamentoResumo):
    """Resposta do router de pagamentos — de propósito NÃO aninha MatriculaOut
    (que aninha PagamentoResumo) para não criar um ciclo de schema; o contexto
    de aluno/turma vem denormalizado nestes dois campos."""

    matricula_id: int
    aluno_nome: str
    turma_modalidade: str
