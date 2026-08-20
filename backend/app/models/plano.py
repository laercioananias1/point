from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class Plano(TimestampMixin, Base):
    """Catálogo de planos mensais do Point, por frequência semanal (1 a 6x) —
    pedido do usuário, 2026-08-19. O admin do Point cadastra o preço de cada
    frequência; é o que ele escolhe ao ativar uma Assinatura."""

    __tablename__ = "planos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    frequencia_semanal: Mapped[int] = mapped_column(Integer)  # 1..6
    preco: Mapped[float] = mapped_column(Numeric(10, 2))
