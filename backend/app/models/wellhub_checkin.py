from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class WellhubCheckin(TimestampMixin, Base):
    """Log solto de check-in Wellhub validado — pedido do usuário,
    2026-09-29: "vincular sempre um checkin com uma aula vai ficar
    complicado... ele fica com um saldo de checkin". Sem turma_id de
    propósito (ver app/services/wellhub.py) — a Wellhub só sabe dizer
    "essa pessoa validou o dia dela", nunca "em qual aula". Uma linha por
    Point+gympass_id+dia (a própria Wellhub só permite 1 check-in por dia
    por usuário — o unique abaixo também torna webhook reentregue
    idempotente: reprocessar o mesmo dia não duplica)."""

    __tablename__ = "wellhub_checkins"
    __table_args__ = (UniqueConstraint("point_id", "gympass_id", "data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    gympass_id: Mapped[str] = mapped_column(String(20), index=True)
    # Preenchido se esse gympass_id já foi associado a um Aluno cadastrado
    # aqui (Aluno.wellhub_gympass_id) — nulo até alguém fazer essa ligação
    # uma vez; o "acerto do mês" (GET /wellhub/reconciliacao) só consegue
    # comparar com "aulas feitas" pra quem tem essa ligação.
    aluno_id: Mapped[int | None] = mapped_column(ForeignKey("alunos.id"), nullable=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    # Nome que a própria Wellhub devolveu na validação — só conferência,
    # não é fonte de verdade de cadastro (mesmo espírito de
    # Checkin.beneficiario_nome pra TotalPass).
    nome_wellhub: Mapped[str | None] = mapped_column(String(160), nullable=True)
    # "webhook" (automático) ou "manual" (professor/admin digitou o
    # gympass_id na recepção) — só auditoria.
    origem: Mapped[str] = mapped_column(String(10))

    aluno: Mapped["Aluno | None"] = relationship()  # noqa: F821

    @property
    def aluno_nome(self) -> str | None:
        return self.aluno.nome if self.aluno is not None else self.nome_wellhub
