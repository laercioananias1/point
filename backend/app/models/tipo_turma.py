from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class TipoTurma(TimestampMixin, Base):
    """Tipo/formato de turma cadastrado pelo Point (pedido do usuário,
    2026-09-09) — ex.: 'Padrão' (recorrente, de sempre), 'Aula individual',
    'Dupla', 'Família'. Só uma etiqueta pra organizar; NÃO carrega o flag
    de turma privada (isso é independente, fica direto em Turma.privada —
    pedido do usuário: "o ser privado ou não tem que ser na turma e não
    no tipo") — dá pra ter, por exemplo, uma turma 'Dupla' privada e outra
    'Dupla' aberta pra qualquer aluno."""

    __tablename__ = "tipos_turma"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    nome: Mapped[str] = mapped_column(String(60))
