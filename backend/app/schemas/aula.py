from datetime import date

from app.schemas.common import ORMModel


class AulaOut(ORMModel):
    id: int
    matricula_id: int
    data: date


class GeracaoAulasOut(ORMModel):
    aulas_geradas: int
