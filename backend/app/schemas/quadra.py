from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut


class QuadraCreate(ORMModel):
    nome: str
    modalidade_ids: list[int] = []


class QuadraUpdate(ORMModel):
    """Substitui o conjunto de modalidades atendidas — não faz merge."""

    nome: str | None = None
    modalidade_ids: list[int] | None = None


class QuadraOut(ORMModel):
    id: int
    point_id: int
    nome: str
    modalidades: list[ModalidadeOut]
