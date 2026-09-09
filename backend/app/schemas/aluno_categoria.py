from app.schemas.categoria import CategoriaOut
from app.schemas.common import ORMModel


class AlunoCategoriaSet(ORMModel):
    categoria_id: int


class AlunoCategoriaOut(ORMModel):
    id: int
    aluno_id: int
    point_id: int
    categoria: CategoriaOut
