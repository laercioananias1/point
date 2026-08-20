from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TurmaExcecao(TimestampMixin, Base):
    """'Essa turma não acontece nessa data específica' (pedido do usuário,
    2026-08-20) — a recorrência semanal continua valendo pras outras
    semanas; só essa data vira exceção. Usado pelo gerador mensal de aulas
    (services/aulas.py) pra pular a data ao gerar as ocorrências."""

    __tablename__ = "turma_excecoes"
    __table_args__ = (UniqueConstraint("turma_id", "data", name="uq_turma_excecao_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))
    data: Mapped[date] = mapped_column(Date)
