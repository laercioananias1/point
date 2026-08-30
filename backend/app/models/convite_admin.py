from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ConviteStatus


class ConviteAdmin(TimestampMixin, Base):
    """Convite de admin do Point — mesmo padrão dos convites de assinatura
    (aluno) e de vínculo (professor): pedido do usuário, 2026-08-26, "não
    quero criar senha de admin, faça o mesmo padrão de aluno e professor"
    (antes, POST /points/{id}/admins criava a conta já com senha definida
    pelo dono do app — removido). O dono do app manda o convite por
    e-mail; quem recebe é quem cria a própria senha (ou só confirma, se já
    tiver conta com esse e-mail — nesse caso a conta GANHA o papel
    admin_point, sem perder o(s) papel(is) que já tinha, igual o convite de
    vínculo faz pra virar professor — pedido do usuário, 2026-08-26, "o
    dono do Point é também o professor")."""

    __tablename__ = "convites_admin"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    nome: Mapped[str] = mapped_column(String(120))
    celular: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(160))

    status: Mapped[ConviteStatus] = mapped_column(Enum(ConviteStatus), default=ConviteStatus.PENDENTE)
    expira_em: Mapped[date] = mapped_column(Date)
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    point: Mapped["Point"] = relationship()  # noqa: F821

    @property
    def expirado(self) -> bool:
        return self.status == ConviteStatus.PENDENTE and self.expira_em < date.today()
