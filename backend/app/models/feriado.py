from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class Feriado(TimestampMixin, Base):
    """Feriado LOCAL, cadastrado pelo admin do Point (pedido do usuário,
    2026-09-01: "o admin pode cadastrar seus feriados locais"). Feriado
    NACIONAL não vira linha aqui — é calculado na hora (ver
    services/feriados.py::feriados_nacionais_do_ano), porque a maioria
    repete todo ano (uns em data fixa, outros móveis por causa da Páscoa)
    e não faz sentido recadastrar ano a ano nem ficar preso a um
    intervalo de anos pré-populado no banco.

    Usado por services/aulas.py::gerar_aulas_do_mes pra nunca gerar Aula
    num feriado (pedido do usuário: "o sistema nesse caso não pode criar
    [aula] nesses dias de feriados") — turma continua existindo, só essa
    ocorrência específica não é gerada, igual TurmaExcecao."""

    __tablename__ = "feriados"
    __table_args__ = (UniqueConstraint("point_id", "data", name="uq_feriado_point_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    data: Mapped[date] = mapped_column(Date)
    nome: Mapped[str] = mapped_column(String(100))
