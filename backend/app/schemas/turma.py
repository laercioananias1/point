from app.schemas.common import ORMModel
from app.schemas.vinculo import VinculoOut


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
    # Dá pro aluno ver com qual professor/Point é a aula sem precisar de mais
    # uma chamada — mesmo padrão de enriquecimento usado em VinculoOut/MatriculaOut.
    vinculo: VinculoOut
