from app.models.enums import MatriculaStatus, MatriculaTipo, PagamentoMeio
from app.schemas.common import ORMModel


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
