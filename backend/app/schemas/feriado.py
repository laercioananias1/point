from datetime import date

from app.schemas.common import ORMModel


class FeriadoCreate(ORMModel):
    data: date
    nome: str


class FeriadoOut(ORMModel):
    # None = feriado nacional (calculado, não é uma linha no banco) — só
    # dá pra remover quando id não é None (feriado local).
    id: int | None
    data: date
    nome: str
    nacional: bool
