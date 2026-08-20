from app.models.enums import MatriculaStatus, MatriculaTipo, PagamentoMeio
from app.schemas.aluno import AlunoOut
from app.schemas.common import ORMModel
from app.schemas.pagamento import PagamentoResumo
from app.schemas.turma import TurmaOut


class MatriculaCreate(ORMModel):
    turma_id: int
    tipo: MatriculaTipo
    fonte_pagamento: PagamentoMeio


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
