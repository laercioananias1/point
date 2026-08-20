from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CreditoMotivo, CreditoStatus


class CreditoReposicao(TimestampMixin, Base):
    """Gerado só em 2 casos: força maior ou cancelamento antecipado do aluno (seção 4.4)."""

    __tablename__ = "creditos_reposicao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))

    motivo: Mapped[CreditoMotivo] = mapped_column(Enum(CreditoMotivo))
    # Dia da ocorrência que gerou o crédito — informativo/auditoria. O modelo
    # não tem uma entidade "Aula" (ocorrência específica de uma Turma
    # recorrente); isso registra qual data motivou o crédito sem precisar
    # criar essa entidade agora.
    data_aula: Mapped[date] = mapped_column(Date)
    data_expiracao: Mapped[date] = mapped_column(Date)
    status: Mapped[CreditoStatus] = mapped_column(
        Enum(CreditoStatus), default=CreditoStatus.DISPONIVEL
    )
    # Preenchido quando o crédito é usado para reagendar (seção 4.4) — a nova
    # matrícula avulsa criada na turma de reposição.
    nova_matricula_id: Mapped[int | None] = mapped_column(
        ForeignKey("matriculas.id"), nullable=True
    )

    matricula: Mapped["Matricula"] = relationship(  # noqa: F821
        back_populates="creditos", foreign_keys=[matricula_id]
    )
