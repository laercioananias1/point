from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Turma(TimestampMixin, Base):
    """Pertence a 1 Vínculo (1 professor + 1 Point); elo com os alunos via Matrícula."""

    __tablename__ = "turmas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vinculo_id: Mapped[int] = mapped_column(ForeignKey("vinculos.id"))

    modalidade: Mapped[str] = mapped_column(String(60))
    quadra: Mapped[str] = mapped_column(String(60))
    capacidade: Mapped[int] = mapped_column(Integer)

    # Recorrência simples para o MVP (ex.: "segunda,quarta 18:00", "semanal").
    # Um modelo de recorrência mais rico (RRULE) pode substituir isso depois.
    dia_semana: Mapped[str] = mapped_column(String(20))
    horario: Mapped[str] = mapped_column(String(5))  # "HH:MM"
    recorrencia: Mapped[str] = mapped_column(String(30), default="semanal")

    vinculo: Mapped["Vinculo"] = relationship(back_populates="turmas")  # noqa: F821
    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="turma")  # noqa: F821
