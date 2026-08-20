from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.quadra import QuadraOut
from app.schemas.vinculo import VinculoOut


class TurmaCreate(ORMModel):
    """Cria uma Turma pra cada combinação de dia × horário — ex.: 2 dias e
    2 horários criam 4 turmas numa chamada só (seção pedido do usuário,
    2026-08-19)."""

    vinculo_id: int
    modalidade_id: int
    quadra_id: int
    capacidade: int
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
    vinculo: VinculoOut
