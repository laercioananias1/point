from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class MatriculaDiaSemana(TimestampMixin, Base):
    """Quais dias da semana ESSE aluno frequenta dentro da Turma (pedido do
    usuário, 2026-08-21: "a turma é criada por hora com N dias... porém a
    matrícula só encaixa se existe uma turma com a mesma qtde de dias" —
    era o bug: a Turma é a agenda inteira do professor (ex.: seg a sex,
    8h); cada aluno usa um SUBCONJUNTO dela — um vem 2x, outro 1x, outro
    todo dia, todos na mesma turma). Sempre um subconjunto de
    Turma.dias_semana — validado em services/assinaturas.py."""

    __tablename__ = "matricula_dias_semana"
    __table_args__ = (
        UniqueConstraint("matricula_id", "dia_semana", name="uq_matricula_dia_semana"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))
    dia_semana: Mapped[str] = mapped_column(String(20))
