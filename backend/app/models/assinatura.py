from datetime import date

from sqlalchemy import Column, Date, Enum, ForeignKey, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import MatriculaStatus, PagamentoMeio, PeriodoDia

# N:N puro — quais Turmas foram escolhidas pra cobrir a frequência da Assinatura.
assinatura_turmas = Table(
    "assinatura_turmas",
    Base.metadata,
    Column("assinatura_id", ForeignKey("assinaturas.id"), primary_key=True),
    Column("turma_id", ForeignKey("turmas.id"), primary_key=True),
)


class Assinatura(TimestampMixin, Base):
    """Plano mensal de um aluno numa modalidade — cadastrado só pelo admin
    do Point (pedido do usuário, 2026-08-20: tirou o fluxo do aluno
    declarar interesse; antes disso, o aluno só dizia o que queria e o
    admin ativava depois — agora o admin faz tudo de uma vez e a assinatura
    já nasce ATIVA). frequencia_semanal_desejada e periodo_dia_desejado
    continuam gravados (o primeiro sempre igual ao Plano escolhido, o
    segundo só documenta o período preferido) — plano_id/data_inicio/turmas
    continuam obrigatórios desde a criação, não há mais estágio 'em
    análise' pra eles ficarem nulos."""

    __tablename__ = "assinaturas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))
    modalidade_id: Mapped[int] = mapped_column(ForeignKey("modalidades.id"))

    frequencia_semanal_desejada: Mapped[int] = mapped_column(Integer)
    periodo_dia_desejado: Mapped[PeriodoDia] = mapped_column(Enum(PeriodoDia))
    fonte_pagamento: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))
    status: Mapped[MatriculaStatus] = mapped_column(
        Enum(MatriculaStatus), default=MatriculaStatus.ATIVA
    )

    plano_id: Mapped[int | None] = mapped_column(ForeignKey("planos.id"), nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)

    aluno: Mapped["Aluno"] = relationship()  # noqa: F821
    point: Mapped["Point"] = relationship()  # noqa: F821
    modalidade: Mapped["Modalidade"] = relationship()  # noqa: F821
    plano: Mapped["Plano | None"] = relationship()  # noqa: F821
    turmas: Mapped[list["Turma"]] = relationship(  # noqa: F821
        secondary="assinatura_turmas"
    )
    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="assinatura")  # noqa: F821

    @property
    def turmas_com_dias(self) -> list[dict]:
        """Cada Turma envolvida e só os dias que ESSE aluno frequenta nela
        (pedido do usuário, 2026-08-21) — `turmas` sozinho mostraria a
        agenda inteira do professor, não o que esse aluno específico usa;
        a verdade de dias fica nas Matrículas mensais ativas por trás."""
        from app.models.enums import MatriculaStatus, MatriculaTipo
        from app.services.aulas import DIAS_SEMANA

        ordem = {dia: i for i, dia in enumerate(DIAS_SEMANA)}
        por_turma: dict[int, list[str]] = {}
        turmas_por_id: dict[int, "Turma"] = {}  # noqa: F821
        for m in self.matriculas:
            if m.status != MatriculaStatus.ATIVA or m.tipo != MatriculaTipo.MENSAL:
                continue
            turmas_por_id[m.turma_id] = m.turma
            por_turma.setdefault(m.turma_id, []).extend(m.dias_semana)
        resultado = []
        for turma_id, dias in por_turma.items():
            dias_unicos = sorted(set(dias), key=lambda d: ordem.get(d, len(DIAS_SEMANA)))
            resultado.append({"turma": turmas_por_id[turma_id], "dias_semana": dias_unicos})
        return resultado
