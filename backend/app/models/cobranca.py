import secrets
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CobrancaStatus


class Cobranca(TimestampMixin, Base):
    """Cobrança de um aluno num Point (pedido do usuário, 2026-09-20:
    "fazer para o financeiro uma tela de cobrança") — dois jeitos de
    nascer: AVULSA, criada à mão pelo admin (uniforme, matrícula, evento —
    assinatura_id nulo), ou MENSALIDADE, gerada sozinha a partir de uma
    Assinatura ativa (assinatura_id + mes_referencia preenchidos; o par é
    único, então gerar de novo no mesmo mês nunca duplica).

    Convive com Pagamento (que é por matrícula e vem do fluxo Pix antigo):
    ao marcar uma mensalidade como paga, o router também grava os
    Pagamentos confirmados das matrículas da assinatura — é isso que
    destrava a geração de aulas e tira o aluno de "em atraso" (ver
    app.services.cobrancas)."""

    __tablename__ = "cobrancas"
    __table_args__ = (UniqueConstraint("assinatura_id", "mes_referencia"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"), index=True)
    assinatura_id: Mapped[int | None] = mapped_column(ForeignKey("assinaturas.id"), nullable=True)

    descricao: Mapped[str] = mapped_column(String(120))
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    vencimento: Mapped[date] = mapped_column(Date)
    status: Mapped[CobrancaStatus] = mapped_column(
        Enum(CobrancaStatus), default=CobrancaStatus.ABERTA
    )
    pago_em: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Sempre dia 1 do mês (ex.: 2026-09-01) — só nas mensalidades geradas.
    mes_referencia: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Pagamento online via Pix do Mercado Pago (pedido do usuário,
    # 2026-10-02) — `pagamento_token` é o código do link público
    # /pagar/<token> (abre sem login, vai no e-mail/WhatsApp). O Pix em si
    # é criado na conta MP do Point quando alguém abre o pagamento, e fica
    # guardado aqui até vencer ou o valor mudar (ver
    # app/services/pix_cobranca.py).
    pagamento_token: Mapped[str] = mapped_column(
        String(32), unique=True, default=lambda: secrets.token_urlsafe(24)
    )
    # Gateway que gerou o Pix ("mercadopago"; amanhã "asaas"...) e o id do
    # pagamento lá — genérico de propósito (pedido do usuário, 2026-10-02:
    # "amanhã posso ter outros conectores para pagamento como Asaas").
    pix_gateway: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pix_pagamento_id: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    pix_copia_cola: Mapped[str | None] = mapped_column(Text, nullable=True)
    pix_qr_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    pix_valor: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    pix_expira_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Cobrança de uma aula avulsa comprada com Pix (pedido do usuário,
    # 2026-10-02): a matrícula que ela confirma ao ser paga, e o prazo pra
    # pagar (o mesmo da reserva da vaga) — depois dele o Pix não vale mais.
    matricula_id: Mapped[int | None] = mapped_column(
        ForeignKey("matriculas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pagar_ate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # "pix" quando o gateway confirmou; nulo = baixa manual do admin.
    pago_via: Mapped[str | None] = mapped_column(String(10), nullable=True)

    aluno: Mapped["Aluno"] = relationship()  # noqa: F821
    assinatura: Mapped["Assinatura | None"] = relationship()  # noqa: F821
    # Lembretes enviados (régua automática ou botão "Lembrar") — pedido do
    # usuário, 2026-10-01.
    lembretes: Mapped[list["CobrancaLembrete"]] = relationship(  # noqa: F821
        order_by="CobrancaLembrete.created_at",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def ultimo_lembrete_em(self) -> date | None:
        return self.lembretes[-1].created_at.date() if self.lembretes else None

    @property
    def aluno_nome(self) -> str:
        return self.aluno.nome

    @property
    def recorrente(self) -> bool:
        return self.assinatura_id is not None

    @property
    def atrasada(self) -> bool:
        return self.status == CobrancaStatus.ABERTA and self.vencimento < date.today()

    @property
    def turma_ids(self) -> list[int]:
        """Turmas onde o aluno tem matrícula ativa — só pro filtro "Todas
        as turmas" da tela (o aluno não pertence a UMA turma; cobrança é
        do aluno, não da turma)."""
        from app.models.enums import MatriculaStatus

        return sorted(
            {m.turma_id for m in self.aluno.matriculas if m.status == MatriculaStatus.ATIVA}
        )
