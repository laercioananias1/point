from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
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

    aluno: Mapped["Aluno"] = relationship()  # noqa: F821
    assinatura: Mapped["Assinatura | None"] = relationship()  # noqa: F821

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
