from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class CobrancaLembrete(TimestampMixin, Base):
    """Lembrete de cobrança enviado (pedido do usuário, 2026-10-01: "pode
    fazer a régua de cobrança") — registra os dois jeitos de mandar: à mão
    pelo botão "Lembrar" da tela (origem "manual", etapa nula) e pela régua
    automática (origem "regua", etapa = dias em relação ao vencimento: -3,
    0, 3, 7). É o registro que impede a régua de mandar a mesma etapa duas
    vezes pra mesma cobrança, e o que a tela mostra como "Lembrado em".
    `created_at` é quando foi enviado."""

    __tablename__ = "cobranca_lembretes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cobranca_id: Mapped[int] = mapped_column(ForeignKey("cobrancas.id", ondelete="CASCADE"), index=True)
    etapa: Mapped[int | None] = mapped_column(Integer, nullable=True)
    origem: Mapped[str] = mapped_column(String(10))
