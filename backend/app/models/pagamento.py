from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import PagamentoMeio, PagamentoStatus


class Pagamento(TimestampMixin, Base):
    """Pix, sempre liquidado na conta do Point (seção 6.1). Dinheiro deixou
    de ser aceito (pedido do usuário, 2026-08-26) — o enum `meio` mantém o
    valor DINHEIRO só pra não quebrar pagamentos antigos já lançados assim.

    Sem valor_taxa_servico nem valor_professor aqui — os dois são apurados no
    fechamento mensal (seção 6.3), não por pagamento.
    """

    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int] = mapped_column(ForeignKey("matriculas.id"))

    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    meio: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))
    status: Mapped[PagamentoStatus] = mapped_column(
        Enum(PagamentoStatus), default=PagamentoStatus.PENDENTE
    )

    # Mês que esse pagamento cobre — só pra matrícula mensal (pedido do
    # usuário, 2026-08-21: mensalidade agora é recorrente de verdade, um
    # pagamento por mês, não "pago uma vez, vale pra sempre"). Sempre o dia 1
    # do mês (ex.: 2026-08-01). Nulo pra matrícula avulsa, que continua sendo
    # um pagamento único sem mês associado.
    mes_referencia: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Só preenchido em pagamentos antigos, de quando dinheiro ainda existia
    # (professor/admin "lançava por" o aluno) — sempre nulo daqui pra frente.
    registrado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    matricula: Mapped["Matricula"] = relationship(back_populates="pagamentos")  # noqa: F821

    @property
    def aulas_cobertas(self) -> list[dict]:
        """Extrato — quais aulas esse pagamento cobre (pedido do usuário,
        2026-08-21: "consigo ter um extrato que o pagamento X refere-se às
        aulas xyz?"). Mensal cobre o mês inteiro de `mes_referencia`: junta
        as aulas já geradas (Aula) com as que foram canceladas nesse
        período (MatriculaExcecao do próprio aluno + TurmaExcecao de força
        maior, que não geram linha em Aula — a exclusão apaga a linha, não
        marca como cancelada). Avulsa não tem mês nem linha em Aula (a
        matrícula É a reserva única) — devolve lista vazia; quem consome
        já sabe disso pelo mes_referencia nulo."""
        if self.mes_referencia is None:
            return []

        import calendar

        ano, mes_num = self.mes_referencia.year, self.mes_referencia.month
        inicio_mes = self.mes_referencia
        fim_mes = date(ano, mes_num, calendar.monthrange(ano, mes_num)[1])

        aulas_geradas = {
            a.data for a in self.matricula.aulas if inicio_mes <= a.data <= fim_mes
        }
        canceladas = {
            e.data for e in self.matricula.excecoes_rel if inicio_mes <= e.data <= fim_mes
        } | {
            e.data for e in self.matricula.turma.excecoes_rel if inicio_mes <= e.data <= fim_mes
        }

        hoje = date.today()
        resultado = []
        for d in sorted(aulas_geradas | canceladas):
            if d in canceladas:
                status = "cancelada"
            elif d < hoje:
                status = "realizada"
            else:
                status = "agendada"
            resultado.append({"data": d, "status": status})
        return resultado
