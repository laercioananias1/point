from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.core.database import Base


class IntegracaoLog(Base):
    """Log de toda chamada a uma integração externa (pedido do usuário,
    2026-09-29: "gostaria de ter uma tela de logs de integrações, assim
    fico sabendo se tá dando erro ou não") — WhatsApp, e-mail (Resend),
    Wellhub e TotalPass hoje são todas "fail-soft": nunca derrubam a
    requisição que as disparou, só imprimiam no console do servidor, que
    ninguém olha. Essa tabela é o que dá pra tela ver.

    Só o dono do app vê essa tela (pedido do usuário, "essa tela só quem
    vê é o adm do sistema") — é diagnóstico da plataforma inteira, não do
    Point; por isso `point_id` é best-effort (preenchido só onde já tinha
    o Point em mãos sem esforço — Wellhub/TotalPass — e nulo em
    WhatsApp/e-mail, que não valia a pena espalhar `db`/`point_id` por
    dezena de call sites só pra logar).

    Sem TimestampMixin de propósito — log é imutável, não tem
    updated_at."""

    __tablename__ = "integracao_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # "whatsapp" | "email" | "wellhub" | "totalpass".
    integracao: Mapped[str] = mapped_column(String(20), index=True)
    # Nome do template/assunto, ou a ação ("webhook_checkin",
    # "checkin_manual") — o que identifica ESSE tipo de chamada.
    evento: Mapped[str] = mapped_column(String(120))
    # Celular, e-mail ou gympass_id do destinatário — só pra identificar
    # rápido na lista, sem virar FK de nada.
    destino: Mapped[str | None] = mapped_column(String(160), nullable=True)
    point_id: Mapped[int | None] = mapped_column(ForeignKey("points.id"), nullable=True)
    sucesso: Mapped[bool] = mapped_column(Boolean)
    # Detalhe do erro, ou uma confirmação curta quando sucesso=True.
    mensagem: Mapped[str] = mapped_column(String(500))
    # Corpo da requisição e da resposta HTTP de verdade (pedido do usuário,
    # 2026-09-29: "quero ver tb o request e response") — texto legível, não
    # JSON aninhado; nunca inclui token/credencial (só o corpo que foi
    # mandado, nunca o header Authorization). Nulo pra falhas antes de
    # qualquer chamada HTTP acontecer (ex.: credencial não configurada).
    request_corpo: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_corpo: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    point: Mapped["Point | None"] = relationship()  # noqa: F821

    @property
    def point_nome(self) -> str | None:
        return self.point.nome if self.point is not None else None
