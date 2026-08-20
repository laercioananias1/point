from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Fechamento(TimestampMixin, Base):
    """Fechamento mensal de um Point (seção 6.3) — na prática dispararia
    sozinho no 5º dia útil via job agendado (seção 7); aqui é um endpoint
    chamável, pronto pra esse job disparar depois. Cada linha é imutável:
    fechar de novo um período já fechado gera um novo registro, não edita
    este — histórico de fechamento não deveria mudar depois do fato.
    """

    __tablename__ = "fechamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    periodo_inicio: Mapped[date] = mapped_column(Date)
    periodo_fim: Mapped[date] = mapped_column(Date)

    # Snapshot da taxa no momento do fechamento — mudar a taxa depois (seção
    # 4.1) não reescreve fechamentos antigos.
    taxa_servico_unitaria: Mapped[float] = mapped_column(Numeric(10, 2))
    quantidade_pagamentos: Mapped[int] = mapped_column(Integer)
    total_taxa_servico: Mapped[float] = mapped_column(Numeric(10, 2))

    point: Mapped["Point"] = relationship()  # noqa: F821
    repasses: Mapped[list["RepasseFechamento"]] = relationship(back_populates="fechamento")


class RepasseFechamento(TimestampMixin, Base):
    """Quanto o Point deve repassar a um professor específico, num fechamento."""

    __tablename__ = "repasses_fechamento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fechamento_id: Mapped[int] = mapped_column(ForeignKey("fechamentos.id"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("professores.id"))
    valor: Mapped[float] = mapped_column(Numeric(10, 2))

    fechamento: Mapped["Fechamento"] = relationship(back_populates="repasses")
    professor: Mapped["Professor"] = relationship()  # noqa: F821
