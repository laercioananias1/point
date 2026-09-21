from datetime import date

from pydantic import Field

from app.models.enums import LancamentoTipo
from app.schemas.common import ORMModel


class ContaCaixaCreate(ORMModel):
    nome: str = Field(min_length=1, max_length=60)


class ContaCaixaOut(ORMModel):
    id: int
    nome: str


class LancamentoCreate(ORMModel):
    tipo: LancamentoTipo
    descricao: str = Field(min_length=1, max_length=120)
    valor: float = Field(gt=0)
    data: date
    conta_id: int | None = None
    # "Repetir todo mês" — só vale com dia de 1 a 28 (ver router).
    recorrente: bool = False


class LancamentoUpdate(ORMModel):
    tipo: LancamentoTipo | None = None
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    valor: float | None = Field(default=None, gt=0)
    data: date | None = None
    # Mandar conta_id: null tira a conta; omitir o campo mantém a atual.
    conta_id: int | None = None


class LancamentoOut(ORMModel):
    id: int
    tipo: LancamentoTipo
    descricao: str
    valor: float
    data: date
    conta_id: int | None
    conta_nome: str | None
    automatico: bool
    fixo_id: int | None
    fixo_ativo: bool
