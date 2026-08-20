from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin

# N:N puro (sem colunas extras) — quais quadras atendem quais modalidades.
modalidade_quadras = Table(
    "modalidade_quadras",
    Base.metadata,
    Column("modalidade_id", ForeignKey("modalidades.id"), primary_key=True),
    Column("quadra_id", ForeignKey("quadras.id"), primary_key=True),
)


class Modalidade(TimestampMixin, Base):
    """Cadastrada pelo admin do Point (seção 4.1) — ex.: 'Beach Tennis',
    'Futevôlei'. duracao_padrao_minutos alimenta o campo de duração da Turma
    na hora de criar (o professor pode sobrescrever por turma)."""

    __tablename__ = "modalidades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    nome: Mapped[str] = mapped_column(String(60))
    duracao_padrao_minutos: Mapped[int] = mapped_column(Integer, default=60)

    quadras: Mapped[list["Quadra"]] = relationship(  # noqa: F821
        secondary=modalidade_quadras, back_populates="modalidades"
    )
