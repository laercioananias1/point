from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.modalidade import modalidade_quadras


class Quadra(TimestampMixin, Base):
    """Cadastrada pelo admin do Point (seção 4.1). Uma quadra física costuma
    atender mais de uma modalidade (ex.: a mesma areia serve beach tennis e
    futevôlei) — daí o N:N com Modalidade em vez de a quadra pertencer a uma
    modalidade só."""

    __tablename__ = "quadras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    nome: Mapped[str] = mapped_column(String(60))

    modalidades: Mapped[list["Modalidade"]] = relationship(  # noqa: F821
        secondary=modalidade_quadras, back_populates="quadras"
    )
