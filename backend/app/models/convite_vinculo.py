from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ConviteStatus, ModeloRepasse


class ConviteVinculo(TimestampMixin, Base):
    """Convite de vínculo — mesmo padrão do Convite de assinatura do aluno
    (pedido do usuário, 2026-08-21: "quem manda a solicitação é o admin do
    Point... ficar no mesmo padrão do aluno"). O professor não solicita mais
    vínculo: o admin decide o acordo de repasse e manda um convite por
    e-mail — preço de aula avulsa/plano é tabela do Point por modalidade,
    não entra aqui (pedido do usuário, 2026-08-21: "com o professor só tem
    o acordo de repasse"). O professor só aceita — se ainda não tem conta,
    cria a própria senha; se já tem, só confirma. Em qualquer um dos dois
    casos, o Vínculo já nasce ATIVO no aceite."""

    __tablename__ = "convites_vinculo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    nome: Mapped[str] = mapped_column(String(120))
    celular: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(160))

    modelo_repasse: Mapped[ModeloRepasse] = mapped_column(Enum(ModeloRepasse))
    valor_repasse: Mapped[float] = mapped_column(Numeric(10, 2))

    status: Mapped[ConviteStatus] = mapped_column(Enum(ConviteStatus), default=ConviteStatus.PENDENTE)
    expira_em: Mapped[date] = mapped_column(Date)
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    vinculo_id: Mapped[int | None] = mapped_column(ForeignKey("vinculos.id"), nullable=True)

    point: Mapped["Point"] = relationship()  # noqa: F821
    vinculo: Mapped["Vinculo | None"] = relationship()  # noqa: F821

    @property
    def expirado(self) -> bool:
        return self.status == ConviteStatus.PENDENTE and self.expira_em < date.today()
