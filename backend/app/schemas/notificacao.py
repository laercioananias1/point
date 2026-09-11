from datetime import datetime

from app.models.enums import NotificacaoTipo
from app.schemas.common import ORMModel


class NotificacaoOut(ORMModel):
    id: int
    tipo: NotificacaoTipo
    titulo: str
    mensagem: str
    lida: bool
    created_at: datetime


class ContagemNaoLidasOut(ORMModel):
    nao_lidas: int
