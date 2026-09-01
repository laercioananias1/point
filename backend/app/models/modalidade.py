from sqlalchemy import Column, ForeignKey, Integer, Numeric, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin

# N:N puro (sem colunas extras) — quais quadras atendem quais modalidades.
modalidade_quadras = Table(
    "modalidade_quadras",
    Base.metadata,
    Column("modalidade_id", ForeignKey("modalidades.id"), primary_key=True),
    Column("quadra_id", ForeignKey("quadras.id"), primary_key=True),
)


class Modalidade(TimestampMixin, Base):
    """Cadastrada pelo admin do Point (seção 4.1) — ex.: 'Beach Tennis',
    'Futevôlei'. duracao_padrao_minutos alimenta o campo de duração da Turma
    na hora de criar (o professor pode sobrescrever por turma).

    preco_avulso é a tabela de preços do Point pra aula avulsa (pedido do
    usuário, 2026-08-21: "esses valores são tabela do point... com o
    professor só tem o acordo de repasse") — não faz parte do Vínculo. Todo
    professor que dá aula dessa modalidade nesse Point cobra o mesmo preço;
    o que varia por professor é só o repasse (Vinculo).

    preco_plano (preço fixo do plano mensal) foi removido daqui (pedido do
    usuário, 2026-09-01: "acho q nao faz mais sentido o preco mensal, pq
    agora temos preco por qtde de dias") — o preço de plano mensal é o de
    Plano.preco, por frequência semanal (1x/2x/3x...), não um valor único
    por modalidade. Ver Matricula.valor_mensalidade."""

    __tablename__ = "modalidades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    nome: Mapped[str] = mapped_column(String(60))
    duracao_padrao_minutos: Mapped[int] = mapped_column(Integer, default=60)
    preco_avulso: Mapped[float] = mapped_column(Numeric(10, 2))

    quadras: Mapped[list["Quadra"]] = relationship(  # noqa: F821
        secondary=modalidade_quadras, back_populates="modalidades"
    )
