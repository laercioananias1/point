from app.schemas.common import ORMModel


class PlanoCreate(ORMModel):
    frequencia_semanal: int  # 1..6
    preco: float


class PlanoOut(ORMModel):
    id: int
    point_id: int
    frequencia_semanal: int
    preco: float
