from datetime import datetime

from app.schemas.common import ORMModel


class IntegracaoLogOut(ORMModel):
    id: int
    integracao: str
    evento: str
    destino: str | None
    point_id: int | None
    point_nome: str | None
    sucesso: bool
    mensagem: str
    request_corpo: str | None
    response_corpo: str | None
    criado_em: datetime
