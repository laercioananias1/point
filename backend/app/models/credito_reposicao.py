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
    # Dia da ocorrência que gerou o crédito — informativo/auditoria. O modelo
    # não tem uma entidade "Aula" (ocorrência específica de uma Turma
    # recorrente); isso registra qual data motivou o crédito sem precisar
    # criar essa entidade agora.
    data_aula: Mapped[date] = mapped_column(Date)
    data_expiracao: Mapped[date] = mapped_column(Date)
    status: Mapped[CreditoStatus] = mapped_column(
        Enum(CreditoStatus), default=CreditoStatus.DISPONIVEL
    )
    # Preenchido quando o crédito é usado para reagendar (seção 4.4) — a nova
    # matrícula avulsa criada na turma de reposição.
    nova_matricula_id: Mapped[int | None] = mapped_column(
        ForeignKey("matriculas.id"), nullable=True
    )

    # Histórico de quem expirou esse crédito à força (pedido do usuário,
    # 2026-09-01: "coloca usuario q fez acao" / "e datahora") — só
    # preenchido quando vira EXPIRADO por um cancelamento de assinatura
    # (não quando vence sozinho pelo tempo, nem quando vira USADO por
    # reagendamento). Sem campo de data próprio — status só muda uma vez
    # depois de criado, updated_at (TimestampMixin) já basta.
    cancelado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    matricula: Mapped["Matricula"] = relationship(  # noqa: F821
        back_populates="creditos", foreign_keys=[matricula_id]
    )
    cancelado_por: Mapped["User | None"] = relationship(foreign_keys=[cancelado_por_id])  # noqa: F821

    @property
    def cancelado_por_nome(self) -> str | None:
        return self.cancelado_por.nome if self.cancelado_por is not None else None

    @property
    def professor_id(self) -> int:
        """Pra CreditoOut expor direto (pedido do usuário, 2026-08-25: "ele
        só pode reagendar com o professor que já dá aula pra ele") — o
        reagendamento fica restrito ao mesmo professor da turma que gerou o
        crédito, então o frontend precisa saber quem é sem outra chamada."""
        return self.matricula.turma.vinculo.professor_id

    @property
    def professor_nome(self) -> str:
        return self.matricula.turma.vinculo.professor.nome

    @property
    def modalidade_nome(self) -> str:
        return self.matricula.turma.modalidade.nome
