from sqlalchemy import Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import VinculoStatus


class Vinculo(TimestampMixin, Base):
    """Entidade de junção N:N entre Professor e Point (seção 3).

    Preço de aula avulsa/plano é tabela do Point, por modalidade — não fica
    aqui. Repasse ao professor saiu do sistema (pedido do usuário,
    2026-09-20: "ainda não está bem definido, pode remover")."""

    __tablename__ = "vinculos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professores.id"))
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    status: Mapped[VinculoStatus] = mapped_column(
        Enum(VinculoStatus), default=VinculoStatus.PENDENTE
    )

    professor: Mapped["Professor"] = relationship(back_populates="vinculos")  # noqa: F821
    point: Mapped["Point"] = relationship(back_populates="vinculos")  # noqa: F821
    turmas: Mapped[list["Turma"]] = relationship(back_populates="vinculo")  # noqa: F821
