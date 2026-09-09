from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class Categoria(TimestampMixin, Base):
    """Nível/categoria de aluno cadastrada pelo admin do Point (pedido do
    usuário, 2026-09-08) — ex.: 'Iniciante', 'Intermediário', 'Avançado'.
    Cor pra destacar visualmente a turma na agenda; Turma fica exclusiva de
    uma única Categoria (seção turmas)."""

    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    nome: Mapped[str] = mapped_column(String(60))
    cor: Mapped[str] = mapped_column(String(7))  # "#rrggbb"
