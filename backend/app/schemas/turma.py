from datetime import date
from typing import Literal

from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.quadra import QuadraOut
from app.schemas.vinculo import VinculoOut


class TurmaCreate(ORMModel):
    """Cria uma Turma pra cada combinação de dia × horário — ex.: 2 dias e
    2 horários criam 4 turmas numa chamada só (pedido do usuário, 2026-08-19).
    periodo_inicio/periodo_fim valem pra todas as turmas do lote.
    periodo_fim=None = recorrente, sem data de término (2026-08-20)."""

    vinculo_id: int
    modalidade_id: int
    quadra_id: int
    capacidade: int
    periodo_inicio: date
    periodo_fim: date | None = None
    dias_semana: list[str]
    horarios: list[str]  # cada um "HH:00" — sempre hora cheia
    duracao_minutos: int | None = None  # None = usa o padrão da modalidade
    recorrencia: str = "semanal"


class TurmaOut(ORMModel):
    id: int
    vinculo_id: int
    modalidade: ModalidadeOut
    quadra: QuadraOut
    capacidade: int
    dia_semana: str
    horario: str
    duracao_minutos: int
    recorrencia: str
    periodo_inicio: date
    periodo_fim: date | None
    excecoes: list[date]
    vinculo: VinculoOut


class TurmaRemocao(ORMModel):
    """Remover uma turma recorrente (pedido do usuário, 2026-08-20) — igual
    editar um evento recorrente num calendário: só essa data, ou essa data
    em diante (encerra a série ali)."""

    escopo: Literal["unica_data", "a_partir_desta_data"]
    data: date


class RemocaoTurmaOut(ORMModel):
    turma_removida: bool  # true = a linha da Turma foi apagada de vez
    aulas_removidas: int
    novo_periodo_fim: date | None
