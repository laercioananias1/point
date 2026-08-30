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
    forma_pagamento_preferida: Mapped[FormaPagamento] = mapped_column(Enum(FormaPagamento))

    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="aluno")  # noqa: F821
