from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Aula(TimestampMixin, Base):
    """Ocorrência concreta gerada por uma Matrícula mensal (pedido do usuário,
    2026-08-19) — uma linha por data real em que o aluno tem aula, derivada
    do dia_semana da Turma dentro do período da Assinatura. Gerada até o fim
    do mês corrente na ativação; o endpoint de geração mensal (roda hoje sob
    demanda, e representaria um job agendado no início de cada mês — seção 7
    do plano de arquitetura) completa os meses seguintes enquanto a
    Assinatura continuar ativa."""

    __tablename__ = "aulas"
    __table_args__ = (UniqueConstraint("matricula_id", "data", name="uq_aula_matricula_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))
    data: Mapped[date] = mapped_column(Date)

    matricula: Mapped["Matricula"] = relationship()  # noqa: F821
