from app.models.enums import MatriculaStatus, MatriculaTipo, ModeloRepasse, PagamentoMeio
from app.schemas.aluno import AlunoOut
from app.schemas.common import ORMModel
from app.schemas.pagamento import PagamentoResumo
from app.schemas.turma import TurmaOut


class MatriculaCreate(ORMModel):
    turma_id: int
    tipo: MatriculaTipo
    fonte_pagamento: PagamentoMeio


class RepasseOverrideUpdate(ORMModel):
    """None em ambos os campos remove a exceção — volta a usar o padrão do
    Vínculo (seção 3.2)."""

    modelo: ModeloRepasse | None
    valor: float | None


class MatriculaOut(ORMModel):
    id: int
    aluno_id: int
    turma_id: int
    tipo: MatriculaTipo
    status: MatriculaStatus
    fonte_pagamento: PagamentoMeio
    aluno: AlunoOut
    turma: TurmaOut
    pagamentos: list[PagamentoResumo] = []
    repasse_override_modelo: ModeloRepasse | None
    repasse_override_valor: float | None
