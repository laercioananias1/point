from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import FormaPagamento


class Aluno(TimestampMixin, Base):
    """Entidade global da plataforma — pode se matricular em vários Points/professores."""

    __tablename__ = "alunos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    contato: Mapped[str] = mapped_column(String(30))  # celular
    email: Mapped[str] = mapped_column(String(255))
    # Nullable (pedido do usuário, 2026-09-11) — aluno vindo de convite
    # avulso não informa forma de pagamento nenhuma no cadastro; escolhe na
    # hora de comprar a primeira aula.
    forma_pagamento_preferida: Mapped[FormaPagamento | None] = mapped_column(
        Enum(FormaPagamento), nullable=True
    )

    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="aluno")  # noqa: F821
