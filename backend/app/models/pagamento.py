from sqlalchemy import Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import PagamentoMeio, PagamentoStatus


class Pagamento(TimestampMixin, Base):
    """Pix ou dinheiro, sempre liquidado na conta do Point (seção 6.1).

    Sem valor_taxa_servico nem valor_professor aqui — os dois são apurados no
    fechamento mensal (seção 6.3), não por pagamento.
    """

    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))

    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    meio: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))
    status: Mapped[PagamentoStatus] = mapped_column(
        Enum(PagamentoStatus), default=PagamentoStatus.PENDENTE
    )

    # Obrigatório quando meio = dinheiro (validado na camada de serviço, não no banco).
    registrado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    matricula: Mapped["Matricula"] = relationship(back_populates="pagamentos")  # noqa: F821
