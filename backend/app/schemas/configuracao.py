from app.schemas.common import ORMModel


class ConfiguracaoOut(ORMModel):
    taxa_servico: float


class ConfiguracaoUpdate(ORMModel):
    taxa_servico: float
