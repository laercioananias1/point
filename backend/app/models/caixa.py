from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import LancamentoTipo


class ContaCaixa(TimestampMixin, Base):
    """Conta onde o dinheiro entra/sai (ex.: "Conta corrente", "Dinheiro
    do balcão") — opcional em cada lançamento ("Sem conta")."""

    __tablename__ = "contas_caixa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    nome: Mapped[str] = mapped_column(String(60))


class LancamentoFixo(TimestampMixin, Base):
    """Modelo de um lançamento que se repete todo mês (pedido do usuário,
    2026-09-20: "repetir todo mês — entra sozinho todo mês, no dia da data
    acima"). Dia 29-31 cai no último dia dos meses mais curtos. O job diário
    (app.services.caixa) cria o LancamentoCaixa do mês quando chega o dia;
    parar de repetir só desativa esta linha, sem apagar o que já foi
    lançado."""

    __tablename__ = "lancamentos_fixos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    tipo: Mapped[LancamentoTipo] = mapped_column(Enum(LancamentoTipo))
    descricao: Mapped[str] = mapped_column(String(120))
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    # 1 a 31 — nos meses mais curtos vale o último dia do mês.
    dia: Mapped[int] = mapped_column(Integer)
    conta_id: Mapped[int | None] = mapped_column(ForeignKey("contas_caixa.id"), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class LancamentoCaixa(TimestampMixin, Base):
    """Uma linha do Caixa do Point — fonte única da tela Caixa. Nasce de
    três jeitos: manual (admin), automático de uma Cobrança paga
    (origem_cobranca_id) ou de um Pagamento confirmado do fluxo antigo
    (origem_pagamento_id), e recorrente (fixo_id). As automáticas não são
    editadas aqui — desfazer o pagamento é que remove a entrada."""

    __tablename__ = "lancamentos_caixa"
    __table_args__ = (UniqueConstraint("fixo_id", "mes_referencia"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    tipo: Mapped[LancamentoTipo] = mapped_column(Enum(LancamentoTipo))
    descricao: Mapped[str] = mapped_column(String(120))
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    data: Mapped[date] = mapped_column(Date, index=True)
    conta_id: Mapped[int | None] = mapped_column(ForeignKey("contas_caixa.id"), nullable=True)

    origem_cobranca_id: Mapped[int | None] = mapped_column(
        ForeignKey("cobrancas.id"), nullable=True, unique=True
    )
    origem_pagamento_id: Mapped[int | None] = mapped_column(
        ForeignKey("pagamentos.id"), nullable=True, unique=True
    )
    fixo_id: Mapped[int | None] = mapped_column(ForeignKey("lancamentos_fixos.id"), nullable=True)
    # Dia 1 do mês que este lançamento cobre — só nos que vêm de um fixo,
    # pra o par (fixo, mês) ser único e o job nunca duplicar.
    mes_referencia: Mapped[date | None] = mapped_column(Date, nullable=True)

    conta: Mapped["ContaCaixa | None"] = relationship()
    fixo: Mapped["LancamentoFixo | None"] = relationship()

    @property
    def conta_nome(self) -> str | None:
        return self.conta.nome if self.conta is not None else None

    @property
    def automatico(self) -> bool:
        return self.origem_cobranca_id is not None or self.origem_pagamento_id is not None

    @property
    def fixo_ativo(self) -> bool:
        return self.fixo is not None and self.fixo.ativo
