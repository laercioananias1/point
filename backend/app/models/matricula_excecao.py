from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class MatriculaExcecao(TimestampMixin, Base):
    """'Esse aluno não tem essa aula nessa data específica' (pedido do
    usuário, 2026-08-20: cancelamento antecipado pelo aluno, com crédito) —
    diferente de TurmaExcecao, que tira a data pra TODOS os alunos da turma
    (força maior); aqui só esse aluno cancelou, a turma continua normal pros
    demais. Usado pelo gerador mensal de aulas (services/aulas.py) pra pular
    a data ao gerar as ocorrências dessa matrícula.

    Registro mais granular de "uma aula foi cancelada" que existe no
    sistema — histórico de cancelamento (pedido do usuário, 2026-09-01:
    "coloca usuario q fez acao" / "e datahora") fica aqui: cancelado_por
    (aluno cancelando a própria aula, ou admin/professor ajustando a agenda
    por ele) e created_at (TimestampMixin, a linha nunca é editada depois
    de criada, então created_at já é a data/hora do cancelamento).

    motivo (pedido do usuário, 2026-09-01: "o professor pode cancelar uma
    aula de um determinado aluno de última hora, precisa informar o
    motivo") — obrigatório quando quem cancela é admin/professor (validado
    no schema, CancelarAulaAdminRequest); nulo quando é o próprio aluno
    cancelando a própria aula (fluxo de autoatendimento não pede motivo)."""

    __tablename__ = "matricula_excecoes"
    __table_args__ = (UniqueConstraint("matricula_id", "data", name="uq_matricula_excecao_data"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))
    data: Mapped[date] = mapped_column(Date)
    cancelado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)

    matricula: Mapped["Matricula"] = relationship()  # noqa: F821
    cancelado_por: Mapped["User | None"] = relationship(foreign_keys=[cancelado_por_id])  # noqa: F821

    @property
    def cancelado_por_nome(self) -> str | None:
        return self.cancelado_por.nome if self.cancelado_por is not None else None
