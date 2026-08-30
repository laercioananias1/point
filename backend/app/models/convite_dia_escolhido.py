from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class ConviteDiaEscolhido(TimestampMixin, Base):
    """Quais dias de cada Turma o admin escolheu pra esse convite (pedido
    do usuário, 2026-08-21) — substitui o M:N simples convite_turmas: agora
    uma Turma pode contribuir só uma PARTE dos seus dias pro plano do
    aluno (ex.: turma seg-sex 8h, aluno escolhe só segunda e quarta pra um
    plano de 2x/semana). Mesma turma pode aparecer em várias linhas, uma
    por dia escolhido."""

    __tablename__ = "convite_dias_escolhidos"
    __table_args__ = (
        UniqueConstraint("convite_id", "turma_id", "dia_semana", name="uq_convite_dia_escolhido"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    convite_id: Mapped[int] = mapped_column(ForeignKey("convites.id"))
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))
    dia_semana: Mapped[str] = mapped_column(String(20))
