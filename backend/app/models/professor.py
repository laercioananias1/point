from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Professor(TimestampMixin, Base):
    """Entidade global da plataforma — não pertence a nenhum Point específico."""

    __tablename__ = "professores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    contato: Mapped[str] = mapped_column(String(30))  # celular
    email: Mapped[str] = mapped_column(String(255))
    modalidades: Mapped[list[str]] = mapped_column(JSON, default=list)

    vinculos: Mapped[list["Vinculo"]] = relationship(back_populates="professor")  # noqa: F821
