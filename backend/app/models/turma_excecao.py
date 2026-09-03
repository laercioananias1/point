from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TurmaExcecao(TimestampMixin, Base):
    """'Essa turma não acontece nessa data específica' (pedido do usuário,
    2026-08-20) — a recorrência semanal continua valendo pras outras
    semanas; só essa data vira exceção. Usado pelo gerador mensal de aulas
    (services/aulas.py) pra pular a data ao gerar as ocorrências.

    motivo (pedido do usuário, 2026-09-01: "o cancelar aula do professor ou
    adm precisa dar um motivo, alguns motivos padrões... Chuva, ventos
    fortes ou outros onde precisa informar o motivo. Essa informação
    precisa aparecer no calendário com um ícone tb de cancelamento e
    mostrar motivo") — texto livre; os "motivos padrão" são só botões no
    front que preenchem esse texto (ver ConvidarProfessor.tsx pro mesmo
    padrão de enum-que-não-virou-enum). Nullable porque exceção antiga
    (antes dessa mudança) não tem motivo nenhum — obrigatório só daqui pra
    frente, validado no schema (TurmaRemocao), não na coluna."""

    __tablename__ = "turma_excecoes"
    __table_args__ = (UniqueConstraint("turma_id", "data", name="uq_turma_excecao_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))
    data: Mapped[date] = mapped_column(Date)
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)
