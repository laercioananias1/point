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
    data_expiracao: Mapped[date] = mapped_column(Date)
    status: Mapped[CreditoStatus] = mapped_column(
        Enum(CreditoStatus), default=CreditoStatus.DISPONIVEL
    )

    matricula: Mapped["Matricula"] = relationship(back_populates="creditos")  # noqa: F821
