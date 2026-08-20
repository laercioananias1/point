from sqlalchemy import Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class ConfiguracaoPlataforma(TimestampMixin, Base):
    """Configuração global da plataforma — linha única (id sempre 1).

    Controlada só pelo dono do app (seção 2). Por enquanto só guarda a taxa
    de serviço fixa (seção 6); outros parâmetros globais da plataforma podem
    entrar aqui no futuro sem precisar de uma tabela nova.
    """

    __tablename__ = "configuracao_plataforma"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    taxa_servico: Mapped[float] = mapped_column(Numeric(10, 2), default=1.00)
