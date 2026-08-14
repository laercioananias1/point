from sqlalchemy import Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ModeloRepasse, VinculoStatus


class Vinculo(TimestampMixin, Base):
    """Entidade de junção N:N entre Professor e Point (seção 3).

    Cada vínculo carrega suas próprias condições comerciais — preço e modelo
    de repasse — aprovadas pelo admin do Point que o professor está entrando.
    """

    __tablename__ = "vinculos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professores.id"))
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    preco_avulso: Mapped[float] = mapped_column(Numeric(10, 2))
    preco_plano: Mapped[float] = mapped_column(Numeric(10, 2))
    modelo_repasse: Mapped[ModeloRepasse] = mapped_column(Enum(ModeloRepasse))
    valor_repasse: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[VinculoStatus] = mapped_column(
        Enum(VinculoStatus), default=VinculoStatus.PENDENTE
    )

    professor: Mapped["Professor"] = relationship(back_populates="vinculos")  # noqa: F821
    point: Mapped["Point"] = relationship(back_populates="vinculos")  # noqa: F821
    turmas: Mapped[list["Turma"]] = relationship(back_populates="vinculo")  # noqa: F821
