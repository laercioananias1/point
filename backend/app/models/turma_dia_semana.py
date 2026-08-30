from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TurmaDiaSemana(TimestampMixin, Base):
    """Um dos dias da semana em que uma Turma acontece (pedido do usuário,
    2026-08-20: "a turma não deveria ser uma pra n dias?"). Uma Turma agora
    representa o grupo/horário recorrente inteiro — ex.: "seg/qua/sex 8h" é
    UMA turma com 3 linhas aqui, não 3 turmas separadas. horário, duração,
    quadra e capacidade continuam únicos por Turma (mesma turma, mesmo
    horário em todo dia que ela acontece)."""

    __tablename__ = "turma_dias_semana"
    __table_args__ = (UniqueConstraint("turma_id", "dia_semana", name="uq_turma_dia_semana"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))
    dia_semana: Mapped[str] = mapped_column(String(20))
