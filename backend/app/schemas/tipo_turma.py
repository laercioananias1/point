from app.schemas.common import ORMModel


class TipoTurmaCreate(ORMModel):
    nome: str


class TipoTurmaUpdate(ORMModel):
    nome: str | None = None


class TipoTurmaOut(ORMModel):
    id: int
    point_id: int
    nome: str
