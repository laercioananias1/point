from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class AlunoCategoria(TimestampMixin, Base):
    """Nível/categoria do Aluno DENTRO de um Point específico (pedido do
    usuário, 2026-09-08) — Aluno é entidade global (pode se matricular em
    vários Points, ver Aluno.__doc__), mas Categoria é cadastrada por Point,
    então a classificação não pode ser um campo direto em Aluno (ficaria
    ambíguo: a categoria "Iniciante" de um Point não é a mesma linha da
    "Iniciante" de outro). Um registro por aluno+Point, igual Vinculo faz
    pra professor+Point. Só a capacidade de classificar por enquanto — não
    valida aluno x turma nesta entrega."""

    __tablename__ = "aluno_categorias"
    __table_args__ = (UniqueConstraint("aluno_id", "point_id", name="uq_aluno_categoria_point"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"))

    categoria: Mapped["Categoria"] = relationship()  # noqa: F821
