from app.schemas.common import ORMModel


class TurmaCreate(ORMModel):
    vinculo_id: int
    modalidade: str
    quadra: str
    capacidade: int
    dia_semana: str
    horario: str  # "HH:MM"
    recorrencia: str = "semanal"


class TurmaOut(ORMModel):
    id: int
    vinculo_id: int
    modalidade: str
    quadra: str
    capacidade: int
    dia_semana: str
    horario: str
    recorrencia: str
