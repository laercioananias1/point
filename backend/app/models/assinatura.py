from datetime import date

from sqlalchemy import Column, Date, Enum, ForeignKey, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import MatriculaStatus, PagamentoMeio, PeriodoDia

# N:N puro — quais Turmas foram escolhidas pra cobrir a frequência da Assinatura.
assinatura_turmas = Table(
    "assinatura_turmas",
    Base.metadata,
    Column("assinatura_id", ForeignKey("assinaturas.id"), primary_key=True),
    Column("turma_id", ForeignKey("turmas.id"), primary_key=True),
)


class Assinatura(TimestampMixin, Base):
    """O 'interesse' do aluno num plano mensal (pedido do usuário, 2026-08-19):
    ele não escolhe turma nenhuma, só declara modalidade + quantas vezes por
    semana quer + período do dia preferido. Nasce EM_ANALISE.

    O admin do Point 'ativa' (endpoint /assinaturas/{id}/ativar): escolhe o
    Plano (define a frequência/preço), escolhe exatamente as turmas
    necessárias e informa a data de início — isso gera as Matrículas
    (uma por turma) por trás, sem o aluno nunca ter visto uma Turma."""

    __tablename__ = "assinaturas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    modalidade_id: Mapped[int] = mapped_column(ForeignKey("modalidades.id"))

    frequencia_semanal_desejada: Mapped[int] = mapped_column(Integer)
    periodo_dia_desejado: Mapped[PeriodoDia] = mapped_column(Enum(PeriodoDia))
    fonte_pagamento: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))
    status: Mapped[MatriculaStatus] = mapped_column(
        Enum(MatriculaStatus), default=MatriculaStatus.EM_ANALISE
    )

    # Preenchidos só na ativação.
    plano_id: Mapped[int | None] = mapped_column(ForeignKey("planos.id"), nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)

    aluno: Mapped["Aluno"] = relationship()  # noqa: F821
    point: Mapped["Point"] = relationship()  # noqa: F821
    modalidade: Mapped["Modalidade"] = relationship()  # noqa: F821
    plano: Mapped["Plano | None"] = relationship()  # noqa: F821
    turmas: Mapped[list["Turma"]] = relationship(  # noqa: F821
        secondary="assinatura_turmas"
    )
    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="assinatura")  # noqa: F821
