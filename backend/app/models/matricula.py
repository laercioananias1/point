from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import (
    MatriculaStatus,
    MatriculaTipo,
    ModeloRepasse,
    PagamentoMeio,
    PagamentoStatus,
)


class Matricula(TimestampMixin, Base):
    """N:N entre Aluno e Turma. Nasce sempre 'em_analise' (seção 4.2)."""

    __tablename__ = "matriculas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))

    tipo: Mapped[MatriculaTipo] = mapped_column(Enum(MatriculaTipo))
    status: Mapped[MatriculaStatus] = mapped_column(
        Enum(MatriculaStatus), default=MatriculaStatus.EM_ANALISE
    )
    fonte_pagamento: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))

    # Preenchido só quando esta matrícula é uma das "fatias" (1 por turma) de
    # uma Assinatura mensal ativada (pedido do usuário, 2026-08-19). Nula pra
    # matrícula avulsa, que continua exatamente como antes.
    assinatura_id: Mapped[int | None] = mapped_column(
        ForeignKey("assinaturas.id"), nullable=True
    )

    # Data específica escolhida pelo aluno pra matrícula AVULSA (pedido do
    # usuário, 2026-08-25: reposição de crédito precisa deixar o aluno
    # escolher dia/horário no calendário, não cair sempre no
    # turma.periodo_inicio) — nula pra matrícula mensal (usa dias_semana +
    # data_inicio_efetiva em vez disso) e pra avulsa antiga, de antes desse
    # campo existir (cai no fallback abaixo, mesmo comportamento de sempre).
    data_avulsa: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Exceção de repasse por aluno (seção 3.2) — quando nulo, usa o padrão do Vínculo.
    repasse_override_modelo: Mapped[ModeloRepasse | None] = mapped_column(
        Enum(ModeloRepasse), nullable=True
    )
    repasse_override_valor: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Histórico de cancelamento (pedido do usuário, 2026-09-01: "sim,
    # inclusive coloca usuario q fez acao" / "e datahora") — quem cancelou
    # essa matrícula (aluno desistindo da própria avulsa, ou admin
    # cancelando a assinatura/avulsa em nome dele) e quando. Campo próprio
    # em vez de reaproveitar updated_at (esse já muda por outro motivo —
    # PATCH .../repasse — e não seria mais "data do cancelamento").
    cancelado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancelado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="matriculas")  # noqa: F821
    turma: Mapped["Turma"] = relationship(back_populates="matriculas")  # noqa: F821
    assinatura: Mapped["Assinatura | None"] = relationship(back_populates="matriculas")  # noqa: F821
    pagamentos: Mapped[list["Pagamento"]] = relationship(back_populates="matricula")  # noqa: F821
    cancelado_por: Mapped["User | None"] = relationship(foreign_keys=[cancelado_por_id])  # noqa: F821
    # foreign_keys explícito: CreditoReposicao tem uma segunda FK para
    # matriculas (nova_matricula_id, a matrícula de reposição) — sem isso o
    # SQLAlchemy não sabe qual usar para este relationship.
    creditos: Mapped[list["CreditoReposicao"]] = relationship(  # noqa: F821
        back_populates="matricula", foreign_keys="CreditoReposicao.matricula_id"
    )
    excecoes_rel: Mapped[list["MatriculaExcecao"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan"
    )
    dias_semana_rel: Mapped[list["MatriculaDiaSemana"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan"
    )
    # Ocorrências geradas por gerar_aulas_do_mes (pedido do usuário,
    # 2026-08-21: "consigo ter um extrato que o pagamento X refere-se às
    # aulas xyz?") — usada por Pagamento.aulas_cobertas pra montar esse
    # extrato. Cancelamento apaga a linha direto (ver cancelar_aula_matricula
    # e cancelar_aula_por_forca_maior), não passa por aqui.
    aulas: Mapped[list["Aula"]] = relationship()  # noqa: F821

    @property
    def valor_mensalidade(self) -> float | None:
        """Preço da mensalidade dessa matrícula (pedido do usuário,
        2026-09-01) — vem do Plano da Assinatura (por frequência semanal,
        1x/2x/3x...), não de um preço fixo por modalidade (Modalidade não
        tem mais preco_plano). None pra matrícula avulsa, que não tem
        mensalidade recorrente — usa Modalidade.preco_avulso, não isso
        aqui."""
        if self.assinatura is None or self.assinatura.plano is None:
            return None
        return float(self.assinatura.plano.preco)

    @property
    def cancelado_por_nome(self) -> str | None:
        return self.cancelado_por.nome if self.cancelado_por is not None else None

    @property
    def excecoes(self) -> list[date]:
        """Datas que ESSE aluno cancelou com antecedência (pedido do
        usuário, 2026-08-20) — pra MatriculaOut expor direto, e pro
        frontend somar com as exceções da Turma ao montar a agenda."""
        return [e.data for e in self.excecoes_rel]

    @property
    def dias_semana(self) -> list[str]:
        """Dias da semana que ESSE aluno frequenta dentro da Turma (pedido
        do usuário, 2026-08-21) — subconjunto de Turma.dias_semana; só
        preenchido pra matrícula mensal (avulsa não usa isso). Ordenado
        segunda→domingo, igual Turma.dias_semana."""
        from app.services.aulas import DIAS_SEMANA

        ordem = {dia: i for i, dia in enumerate(DIAS_SEMANA)}
        return sorted(
            (d.dia_semana for d in self.dias_semana_rel), key=lambda d: ordem.get(d, len(DIAS_SEMANA))
        )

    @property
    def mes_atual_pago(self) -> bool:
        """Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21):
        matrícula mensal só conta como paga se tem um Pagamento CONFIRMADO
        do mês corrente — o mês anterior pago não vale pra este mês.
        Avulsa continua com a regra antiga (qualquer confirmado, sem mês).

        Wellhub/TotalPass conta como sempre paga (pedido do usuário,
        2026-09-01) — não existe Pagamento pra um benefício, então "mês
        pago" não se aplica; sem isso o frontend mostraria um "pagar"
        que não devia existir pra essas matrículas."""
        if self.fonte_pagamento != PagamentoMeio.PIX:
            return True
        if self.tipo != MatriculaTipo.MENSAL:
            return any(p.status == PagamentoStatus.CONFIRMADO for p in self.pagamentos)
        mes_atual = date.today().replace(day=1)
        return any(
            p.status == PagamentoStatus.CONFIRMADO and p.mes_referencia == mes_atual
            for p in self.pagamentos
        )

    @property
    def pagamento_pendente_atual(self) -> bool:
        """Já lançou pagamento do período atual (Pix ou dinheiro) mas ainda
        não foi confirmado pelo admin do Point (pedido do usuário,
        2026-08-21: Pix deixou de confirmar sozinho na hora — agora passa
        pela mesma conferência manual do dinheiro). Pro frontend saber
        quando mostrar "aguardando confirmação" em vez do botão de pagar.

        Sempre False pra Wellhub/TotalPass (pedido do usuário, 2026-09-01) —
        não tem pagamento nenhum sendo lançado/aguardando confirmação."""
        if self.fonte_pagamento != PagamentoMeio.PIX:
            return False
        if self.tipo != MatriculaTipo.MENSAL:
            return any(p.status == PagamentoStatus.PENDENTE for p in self.pagamentos)
        mes_atual = date.today().replace(day=1)
        return any(
            p.status == PagamentoStatus.PENDENTE and p.mes_referencia == mes_atual
            for p in self.pagamentos
        )

    @property
    def inadimplente(self) -> bool:
        """Mensalidade em atraso (pedido do usuário, 2026-08-21) — deve o
        mês anterior ao de hoje. Ver a regra completa em
        app.services.aulas.matricula_inadimplente (import local aqui pra
        evitar import circular — aulas.py importa Matricula)."""
        from app.services.aulas import matricula_inadimplente

        return matricula_inadimplente(self)

    @property
    def e_reposicao(self) -> bool:
        """Essa avulsa nasceu de um crédito reagendado, não de compra
        direta (pedido do usuário, 2026-09-01: "Aula Avulsa" e "Aula de
        Reposição" são ícones/conceitos diferentes no calendário) — via
        CreditoReposicao.nova_matricula_id, sem virar relationship pra não
        colidir com o overlap que já existe entre Matricula.creditos e
        CreditoReposicao.matricula_id (mesma tabela, FK diferente)."""
        if self.tipo != MatriculaTipo.AVULSA:
            return False
        sessao = object_session(self)
        if sessao is None:
            return False
        from app.models.credito_reposicao import CreditoReposicao

        return (
            sessao.query(CreditoReposicao.id)
            .filter(CreditoReposicao.nova_matricula_id == self.id)
            .first()
            is not None
        )

    @property
    def data_inicio_efetiva(self) -> date:
        """A partir de quando essa matrícula realmente vale — o maior entre
        o início da Turma e o início da Assinatura, se houver (pedido do
        usuário, 2026-08-21: a agenda do aluno não pode mostrar aulas de
        antes dele ter entrado, mesmo que a turma já rodasse há mais tempo
        pra outros alunos). Mesma lógica já usada em gerar_aulas_do_mes.

        Matrícula avulsa com data própria (pedido do usuário, 2026-08-25 —
        reposição de crédito) usa exatamente essa data, não o início da
        Turma (que é só quando o PROFESSOR abriu a turma, não tem nada a
        ver com o dia que ESSE aluno escolheu reagendar)."""
        if self.tipo == MatriculaTipo.AVULSA and self.data_avulsa is not None:
            return self.data_avulsa
        inicio = self.turma.periodo_inicio
        if self.assinatura and self.assinatura.data_inicio and self.assinatura.data_inicio > inicio:
            return self.assinatura.data_inicio
        return inicio
