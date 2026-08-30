from datetime import date

from pydantic import Field

from app.models.enums import MatriculaStatus, PagamentoMeio, PeriodoDia
from app.schemas.aluno import AlunoOut
from app.schemas.common import ORMModel
from app.schemas.convite import ConviteTurmaEscolhaOut
from app.schemas.modalidade import ModalidadeOut
from app.schemas.plano import PlanoOut


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
    # Cada turma envolvida e só os dias que ESSE aluno frequenta nela
    # (pedido do usuário, 2026-08-21) — lido de Assinatura.turmas_com_dias,
    # não da relação `turmas` (que seria a agenda inteira da turma).
    turmas: list[ConviteTurmaEscolhaOut] = Field(validation_alias="turmas_com_dias")
