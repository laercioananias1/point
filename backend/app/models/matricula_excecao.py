from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class MatriculaExcecao(TimestampMixin, Base):
    """'Esse aluno não tem essa aula nessa data específica' (pedido do
    usuário, 2026-08-20: cancelamento antecipado pelo aluno, com crédito) —
    diferente de TurmaExcecao, que tira a data pra TODOS os alunos da turma
    (força maior); aqui só esse aluno cancelou, a turma continua normal pros
    demais. Usado pelo gerador mensal de aulas (services/aulas.py) pra pular
    a data ao gerar as ocorrências dessa matrícula."""

    __tablename__ = "matricula_excecoes"
    __table_args__ = (UniqueConstraint("matricula_id", "data", name="uq_matricula_excecao_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))
    data: Mapped[date] = mapped_column(Date)
