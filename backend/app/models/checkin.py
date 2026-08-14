from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CheckinOrigem, CheckinStatus


class Checkin(TimestampMixin, Base):
    """Simplificado para o MVP núcleo — só origem 'presumido' (pagamento direto ao Point).

    Origens Wellhub/TotalPass e o estado 'pendente_atribuicao' entram na Fase 2
    (integração de benefícios, seção 5 do plano de arquitetura).
    """

    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int | None] = mapped_column(ForeignKey("matriculas.id"), nullable=True)

    data_hora: Mapped[datetime] = mapped_column(DateTime)
    origem: Mapped[CheckinOrigem] = mapped_column(Enum(CheckinOrigem))
    status: Mapped[CheckinStatus] = mapped_column(
        Enum(CheckinStatus), default=CheckinStatus.CONFIRMADO
    )

    # Só registro/histórico — não muda cobrança nem gera crédito (seção 4.4).
    falta_marcada_professor: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
