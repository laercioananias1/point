from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import NotificacaoTipo


class Notificacao(TimestampMixin, Base):
    """Notificação dentro do próprio app (pedido do usuário, 2026-09-11:
    "esse tipo de msg é bom tb ter no app... já tava previsto lá no início
    fazermos uma tela de notificações") — espelha em texto, dentro do
    produto, o mesmo aviso que já sai por WhatsApp/e-mail, pra quem não
    olha o WhatsApp na hora (ou nunca informou celular) não perder o
    aviso. Por enquanto só o cancelamento de aula gera uma linha aqui — a
    tabela é genérica de propósito pra outros eventos (convite, lembrete
    de aula, etc.) reaproveitarem depois, sem mudar de desenho."""

    __tablename__ = "notificacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tipo: Mapped[NotificacaoTipo] = mapped_column(Enum(NotificacaoTipo))
    titulo: Mapped[str] = mapped_column(String(120))
    mensagem: Mapped[str] = mapped_column(String(500))
    lida: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship()  # noqa: F821
