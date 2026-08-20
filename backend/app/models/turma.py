from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Turma(TimestampMixin, Base):
    """Pertence a 1 Vínculo (1 professor + 1 Point); elo com os alunos via Matrícula.

    Cada linha é UM par dia_semana + horário (uma recorrência semanal só) —
    "segunda 18h" e "quarta 18h" são duas Turmas distintas, mesmo com a mesma
    modalidade/quadra/professor. O endpoint de criação cria várias de uma vez
    a partir de uma seleção de dias × horários (pedido do usuário, 2026-08-19).

    periodo_inicio/periodo_fim delimitam a vigência — além de dizer até quando
    a turma roda, é o que permite checar conflito de agenda do professor: duas
    turmas do mesmo professor, mesmo dia_semana e horário, só colidem de
    verdade se os períodos se sobrepõem. periodo_fim nulo = recorrente sem
    data de término (pedido do usuário, 2026-08-20) — todo lugar que compara
    com periodo_fim precisa tratar NULL como 'nunca termina', não como
    'não sabemos'."""

    __tablename__ = "turmas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vinculo_id: Mapped[int] = mapped_column(ForeignKey("vinculos.id"))
    modalidade_id: Mapped[int] = mapped_column(ForeignKey("modalidades.id"))
    quadra_id: Mapped[int] = mapped_column(ForeignKey("quadras.id"))

    capacidade: Mapped[int] = mapped_column(Integer)

    dia_semana: Mapped[str] = mapped_column(String(20))
    horario: Mapped[str] = mapped_column(String(5))  # "HH:00" — sempre hora cheia
    duracao_minutos: Mapped[int] = mapped_column(Integer, default=60)
    recorrencia: Mapped[str] = mapped_column(String(30), default="semanal")
    periodo_inicio: Mapped[date] = mapped_column(Date)
    periodo_fim: Mapped[date | None] = mapped_column(Date, nullable=True)

    vinculo: Mapped["Vinculo"] = relationship(back_populates="turmas")  # noqa: F821
    modalidade: Mapped["Modalidade"] = relationship()  # noqa: F821
    quadra: Mapped["Quadra"] = relationship()  # noqa: F821
    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="turma")  # noqa: F821
