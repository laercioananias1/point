from datetime import date
from typing import Literal

from pydantic import field_validator

from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.quadra import QuadraOut
from app.schemas.vinculo import VinculoOut
from app.services.aulas import DIAS_SEMANA


class TurmaCreate(ORMModel):
    """Cria uma Turma pra cada horário selecionado, cada uma cobrindo todos
    os dias marcados — ex.: 3 dias e 2 horários criam 2 turmas (uma por
    horário, cada uma com os 3 dias), não 6 (pedido do usuário, 2026-08-20:
    turma passou a ser o grupo/horário recorrente inteiro, não 1 dia só).
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

    @field_validator("dias_semana")
    @classmethod
    def _valida_dias_semana(cls, valor: list[str]) -> list[str]:
        # Achamos uma linha de teste com um valor inválido em dev que
        # derrubava a resposta de listagem (2026-08-20) — validar aqui
        # impede que algo assim volte a entrar no banco.
        invalidos = sorted(set(valor) - set(DIAS_SEMANA))
        if invalidos:
            raise ValueError(f"Dia(s) da semana inválido(s): {', '.join(invalidos)}")
        return valor


class TurmaOut(ORMModel):
    id: int
    vinculo_id: int
    modalidade: ModalidadeOut
    quadra: QuadraOut
    capacidade: int
    dias_semana: list[str]
    horario: str
    duracao_minutos: int
    recorrencia: str
    periodo_inicio: date
    periodo_fim: date | None
    excecoes: list[date]
    vinculo: VinculoOut


class TurmaProlongamento(ORMModel):
    """Estender o período de uma turma — o inverso do 'remover a partir
    desta data' (pedido do usuário, 2026-08-20). Só alarga pra frente: não
    dá pra usar isso pra encurtar (use a remoção pra isso), nem numa turma
    que já é recorrente sem fim. periodo_fim=None = tornar recorrente."""

    periodo_fim: date | None = None


class TurmaRemocao(ORMModel):
    """Remover uma turma recorrente (pedido do usuário, 2026-08-20) — igual
    editar um evento recorrente num calendário: só essa data, ou essa data
    em diante (encerra a série ali).

    gerar_credito (pedido do usuário, 2026-08-28: "é natural gerar o
    crédito [quando tem aluno matriculado] ... coloca um check pra
    confirmar") — opcional, marcado por padrão no front quando a
    ocorrência tem aluno; sempre gera pra data da ocorrência sendo
    removida (nunca pras datas futuras do escopo 'a_partir_desta_data',
    que encerra a série, não é uma reposição pontual)."""

    escopo: Literal["unica_data", "a_partir_desta_data"]
    data: date
    gerar_credito: bool = False


class RemocaoTurmaOut(ORMModel):
    turma_removida: bool  # true = a linha da Turma foi apagada de vez
    aulas_removidas: int
    novo_periodo_fim: date | None
    creditos_gerados: int
