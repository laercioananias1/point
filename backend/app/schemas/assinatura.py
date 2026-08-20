from datetime import date

from app.models.enums import MatriculaStatus, PagamentoMeio, PeriodoDia
from app.schemas.aluno import AlunoOut
from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.plano import PlanoOut
from app.schemas.turma import TurmaOut


class AssinaturaCreate(ORMModel):
    """O 'interesse' do aluno — sem escolher turma nenhuma (pedido do
    usuário, 2026-08-19)."""

    point_id: int
    modalidade_id: int
    frequencia_semanal_desejada: int  # 1..6
    periodo_dia_desejado: PeriodoDia
    fonte_pagamento: PagamentoMeio


class AssinaturaAtivar(ORMModel):
    plano_id: int
    turma_ids: list[int]
    data_inicio: date


class AssinaturaOut(ORMModel):
    id: int
    aluno: AlunoOut
    point_id: int
    modalidade: ModalidadeOut
    frequencia_semanal_desejada: int
    periodo_dia_desejado: PeriodoDia
    fonte_pagamento: PagamentoMeio
    status: MatriculaStatus
    plano: PlanoOut | None
    data_inicio: date | None
    turmas: list[TurmaOut]
