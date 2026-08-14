from sqlalchemy import Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import MatriculaStatus, MatriculaTipo, ModeloRepasse, PagamentoMeio


class Matricula(TimestampMixin, Base):
    """N:N entre Aluno e Turma. Nasce sempre 'em_analise' (seção 4.2)."""

    __tablename__ = "matriculas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))

    tipo: Mapped[MatriculaTipo] = mapped_column(Enum(MatriculaTipo))
    status: Mapped[MatriculaStatus] = mapped_column(
        Enum(MatriculaStatus), default=MatriculaStatus.EM_ANALISE
    )
    fonte_pagamento: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))

    # Exceção de repasse por aluno (seção 3.2) — quando nulo, usa o padrão do Vínculo.
    repasse_override_modelo: Mapped[ModeloRepasse | None] = mapped_column(
        Enum(ModeloRepasse), nullable=True
    )
    repasse_override_valor: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="matriculas")  # noqa: F821
    turma: Mapped["Turma"] = relationship(back_populates="matriculas")  # noqa: F821
    pagamentos: Mapped[list["Pagamento"]] = relationship(back_populates="matricula")  # noqa: F821
    creditos: Mapped[list["CreditoReposicao"]] = relationship(back_populates="matricula")  # noqa: F821
