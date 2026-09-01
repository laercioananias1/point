from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class RedefinicaoSenha(TimestampMixin, Base):
    """Token de redefinição de senha por e-mail (pedido do usuário,
    2026-09-01: "a troca de senha precisa ser por email" — substitui a
    tela de trocar senha que exigia saber a senha atual, ver
    app/routers/auth.py). Vida curta (1h, não os 7 dias dos convites — não
    tem por quê deixar um link de redefinição de senha válido por dias) e
    uso único: `usado_em` marca consumo, sem status/cancelamento como os
    convites porque não faz sentido "cancelar" um pedido de redefinição —
    só expira ou é usado."""

    __tablename__ = "redefinicoes_senha"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expira_em: Mapped[datetime] = mapped_column(DateTime)
    usado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821

    @property
    def valido(self) -> bool:
        from datetime import timezone

        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        return self.usado_em is None and self.expira_em > agora
