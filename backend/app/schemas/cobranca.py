from datetime import date

from pydantic import Field

from app.models.enums import CobrancaStatus
from app.schemas.common import ORMModel


class CobrancaCreate(ORMModel):
    aluno_id: int
    descricao: str = Field(min_length=1, max_length=120)
    valor: float = Field(gt=0)
    vencimento: date


class CobrancaUpdate(ORMModel):
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    valor: float | None = Field(default=None, gt=0)
    vencimento: date | None = None


class CobrancaOut(ORMModel):
    id: int
    aluno_id: int
    aluno_nome: str
    descricao: str
    valor: float
    vencimento: date
    status: CobrancaStatus
    atrasada: bool
    pago_em: date | None
    recorrente: bool
    turma_ids: list[int]


class CobrancaAlunoOut(ORMModel):
    id: int
    nome: str


class MensalidadesGeradasOut(ORMModel):
    criadas: int
