from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class WellhubCheckin(TimestampMixin, Base):
    """Log solto de check-in Wellhub validado — pedido do usuário,
    2026-09-29: "vincular sempre um checkin com uma aula vai ficar
    complicado... ele fica com um saldo de checkin". Sem turma_id de
    propósito (ver app/services/wellhub.py) — a Wellhub só sabe dizer
    "essa pessoa validou o dia dela", nunca "em qual aula". Uma linha por
    check-in validado com sucesso — pode haver mais de uma no mesmo dia
    (pedido do usuário, 2026-09-30); quem barra duplicidade é a própria
    Wellhub, que recusa validar o mesmo check-in duas vezes."""

    __tablename__ = "wellhub_checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    # "wellhub" ou "totalpass" (pedido do usuário, 2026-09-30: "trata tudo
    # como a mesma coisa") — a tabela ficou com o nome da primeira.
    plataforma: Mapped[str] = mapped_column(String(20), default="wellhub", server_default="wellhub")
    # Identificador da pessoa na plataforma: Gympass ID na Wellhub,
    # documento do beneficiário na TotalPass.
    gympass_id: Mapped[str] = mapped_column(String(32), index=True)
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
    # Só vêm no evento do webhook — check-in manual fica sem.
    email_wellhub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefone_wellhub: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # "webhook" (automático) ou "manual" (professor/admin digitou o
    # gympass_id na recepção) — só auditoria.
    origem: Mapped[str] = mapped_column(String(10))

    aluno: Mapped["Aluno | None"] = relationship()  # noqa: F821

    @property
    def aluno_nome(self) -> str | None:
        return self.aluno.nome if self.aluno is not None else self.nome_wellhub
