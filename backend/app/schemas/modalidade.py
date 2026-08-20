from app.schemas.common import ORMModel


class ModalidadeCreate(ORMModel):
    nome: str
    duracao_padrao_minutos: int = 60


class ModalidadeOut(ORMModel):
    id: int
    point_id: int
    nome: str
    duracao_padrao_minutos: int
