"""Painel de Relatórios (design/telas/Relatorios.dc.html — pedido do usuário,
2026-10-01: "vamos fazer o relatório, esse tem protótipo").

Tudo calculado por período (semana, mês ou trimestre corrente) e comparado
com o período anterior de mesmo tamanho. Ocupação e faltas saem das
ocorrências reais das turmas (dia da semana × período, menos exceções e
feriados), com as mesmas regras de quem tem aula em cada data usadas no
resto do app (app.services.aulas.matricula_tem_aula_em) — só reescritas
aqui sem a consulta de feriado por matrícula, porque o feriado já é
descartado na ocorrência da turma (com milhares de pares turma×data num
trimestre, uma consulta por par ficaria lenta).

Limitações conhecidas:
- matrícula cancelada depois não conta nas semanas em que ainda estava
  ativa (o histórico de status não é guardado);
- faltas só contam aulas passadas em que alguém marcou presença — aula sem
  chamada nenhuma não vira 100% de falta."""

import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.aluno import Aluno
from app.models.caixa import LancamentoCaixa
from app.models.checkin import Checkin
from app.models.cobranca import Cobranca
from app.models.enums import (
    LancamentoTipo,
    MatriculaStatus,
    MatriculaTipo,
    SolicitacaoExperimentalStatus,
    VinculoStatus,
)
from app.models.matricula import Matricula
from app.models.solicitacao_experimental import SolicitacaoExperimental
from app.models.turma import Turma
from app.models.vinculo import Vinculo
from app.models.wellhub_checkin import WellhubCheckin
from app.services.aulas import DIAS_SEMANA as DIAS
from app.services.feriados import feriados_do_periodo

ROTULO_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]


def intervalo(periodo: str, hoje: date) -> tuple[date, date]:
    """Semana (seg→dom), mês ou trimestre (os 3 meses até o corrente)."""
    if periodo == "semana":
        inicio = hoje - timedelta(days=hoje.weekday())
        return inicio, inicio + timedelta(days=6)
    fim = date(hoje.year, hoje.month, calendar.monthrange(hoje.year, hoje.month)[1])
    meses = 3 if periodo == "trimestre" else 1
    ano, mes = hoje.year, hoje.month - (meses - 1)
    while mes <= 0:
        ano, mes = ano - 1, mes + 12
    return date(ano, mes, 1), fim


def intervalo_anterior(periodo: str, inicio: date) -> tuple[date, date]:
    if periodo == "semana":
        return inicio - timedelta(days=7), inicio - timedelta(days=1)
    fim = inicio - timedelta(days=1)
    return intervalo(periodo, fim)


@dataclass
class Ocorrencia:
    turma: Turma
    data: date
    inscritos: int
    presentes: int
    chamada_feita: bool


@dataclass
class Periodo:
    inicio: date
    fim: date
    ocorrencias: list[Ocorrencia] = field(default_factory=list)


def _matricula_tem_aula(m: Matricula, data: date, dia: str) -> bool:
    if m.status != MatriculaStatus.ATIVA:
        return False
    if m.tipo == MatriculaTipo.MENSAL:
        if data < m.data_inicio_efetiva:
            return False
        if m.turma.periodo_fim is not None and data > m.turma.periodo_fim:
            return False
        if dia not in m.dias_semana:
            return False
        return data not in {e.data for e in m.excecoes_rel}
    return m.data_avulsa == data


def turmas_do_point(db: Session, point_id: int) -> list[Turma]:
    return (
        db.query(Turma)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(Vinculo.point_id == point_id, Vinculo.status == VinculoStatus.ATIVO)
        .all()
    )


def ocorrencias(db: Session, point_id: int, turmas: list[Turma], inicio: date, fim: date) -> Periodo:
    feriados = feriados_do_periodo(db, point_id, inicio, fim)
    turma_ids = [t.id for t in turmas]

    experimentais: dict[tuple[int, date], int] = defaultdict(int)
    for turma_id, data in (
        db.query(SolicitacaoExperimental.turma_id, SolicitacaoExperimental.data)
        .filter(
            SolicitacaoExperimental.turma_id.in_(turma_ids),
            SolicitacaoExperimental.data >= inicio,
            SolicitacaoExperimental.data <= fim,
            SolicitacaoExperimental.status == SolicitacaoExperimentalStatus.APROVADA,
        )
        .all()
    ):
        experimentais[(turma_id, data)] += 1

    presencas: dict[tuple[int, date], int] = defaultdict(int)
    for turma_id, data_hora in (
        db.query(Checkin.turma_id, Checkin.data_hora)
        .filter(
            Checkin.turma_id.in_(turma_ids),
            Checkin.data_hora >= datetime.combine(inicio, datetime.min.time()),
            Checkin.data_hora <= datetime.combine(fim, datetime.max.time()),
        )
        .all()
    ):
        presencas[(turma_id, data_hora.date())] += 1

    resultado = Periodo(inicio, fim)
    dia_atual = inicio
    while dia_atual <= fim:
        if dia_atual not in feriados:
            dia = DIAS[dia_atual.weekday()]
            for t in turmas:
                if dia not in t.dias_semana or dia_atual < t.periodo_inicio:
                    continue
                if t.periodo_fim is not None and dia_atual > t.periodo_fim:
                    continue
                if dia_atual in t.excecoes:
                    continue
                inscritos = sum(1 for m in t.matriculas if _matricula_tem_aula(m, dia_atual, dia))
                inscritos += experimentais[(t.id, dia_atual)]
                presentes = presencas[(t.id, dia_atual)]
                resultado.ocorrencias.append(
                    Ocorrencia(t, dia_atual, inscritos, presentes, chamada_feita=presentes > 0)
                )
        dia_atual += timedelta(days=1)
    return resultado


def ocupacao_pct(ocs: list[Ocorrencia]) -> int | None:
    capacidade = sum(o.turma.capacidade for o in ocs)
    if capacidade == 0:
        return None
    return round(100 * sum(min(o.inscritos, o.turma.capacidade) for o in ocs) / capacidade)


def faltas_pct(ocs: list[Ocorrencia], hoje: date) -> int | None:
    """Só aulas passadas com chamada feita (alguém marcou presença)."""
    com_chamada = [o for o in ocs if o.data < hoje and o.chamada_feita and o.inscritos > 0]
    inscritos = sum(o.inscritos for o in com_chamada)
    if inscritos == 0:
        return None
    presentes = sum(min(o.presentes, o.inscritos) for o in com_chamada)
    return round(100 * (inscritos - presentes) / inscritos)


def receita(db: Session, point_id: int, inicio: date, fim: date) -> float:
    return float(
        db.query(func.coalesce(func.sum(LancamentoCaixa.valor), 0))
        .filter(
            LancamentoCaixa.point_id == point_id,
            LancamentoCaixa.tipo == LancamentoTipo.ENTRADA,
            LancamentoCaixa.data >= inicio,
            LancamentoCaixa.data <= fim,
        )
        .scalar()
    )


def receita_por_origem(db: Session, point_id: int, inicio: date, fim: date) -> list[tuple[str, float]]:
    linhas = (
        db.query(LancamentoCaixa, Cobranca.assinatura_id)
        .outerjoin(Cobranca, LancamentoCaixa.origem_cobranca_id == Cobranca.id)
        .filter(
            LancamentoCaixa.point_id == point_id,
            LancamentoCaixa.tipo == LancamentoTipo.ENTRADA,
            LancamentoCaixa.data >= inicio,
            LancamentoCaixa.data <= fim,
        )
        .all()
    )
    totais: dict[str, float] = defaultdict(float)
    for lanc, assinatura_id in linhas:
        if lanc.origem_cobranca_id is not None:
            chave = "Mensalidades" if assinatura_id is not None else "Cobranças avulsas"
        elif lanc.origem_pagamento_id is not None:
            chave = "Aulas pagas no Pix"
        elif lanc.fixo_id is not None:
            chave = "Entradas fixas"
        else:
            chave = "Outras entradas"
        totais[chave] += float(lanc.valor)
    ordem = ["Mensalidades", "Cobranças avulsas", "Aulas pagas no Pix", "Entradas fixas", "Outras entradas"]
    return [(k, totais[k]) for k in ordem if totais.get(k)]


def checkins_plataformas(db: Session, point_id: int, inicio: date, fim: date) -> dict[str, int]:
    return dict(
        db.query(WellhubCheckin.plataforma, func.count(WellhubCheckin.id))
        .filter(
            WellhubCheckin.point_id == point_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .group_by(WellhubCheckin.plataforma)
        .all()
    )


def funil_experimental(db: Session, turma_ids: list[int], point_id: int, inicio: date, fim: date) -> list[int]:
    """[pedidos, confirmadas, compareceram, se matricularam] — pedidos
    feitos no período. "Se matriculou" = o e-mail do pedido virou aluno com
    matrícula nesse Point depois do pedido."""
    pedidos = (
        db.query(SolicitacaoExperimental)
        .filter(
            SolicitacaoExperimental.turma_id.in_(turma_ids),
            SolicitacaoExperimental.created_at >= datetime.combine(inicio, datetime.min.time()),
            SolicitacaoExperimental.created_at <= datetime.combine(fim, datetime.max.time()),
        )
        .all()
    )
    if not pedidos:
        return [0, 0, 0, 0]
    ids = [p.id for p in pedidos]
    compareceram = {
        sid
        for (sid,) in db.query(Checkin.solicitacao_experimental_id)
        .filter(Checkin.solicitacao_experimental_id.in_(ids))
        .all()
    }
    emails = {p.email.strip().lower() for p in pedidos}
    primeira_matricula: dict[str, datetime] = {}
    for email, criada in (
        db.query(func.lower(Aluno.email), func.min(Matricula.created_at))
        .join(Matricula, Matricula.aluno_id == Aluno.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(Vinculo.point_id == point_id, func.lower(Aluno.email).in_(emails))
        .group_by(func.lower(Aluno.email))
        .all()
    ):
        primeira_matricula[email] = criada
    matricularam = sum(
        1
        for p in pedidos
        if (m := primeira_matricula.get(p.email.strip().lower())) is not None and m >= p.created_at
    )
    confirmadas = sum(1 for p in pedidos if p.status == SolicitacaoExperimentalStatus.APROVADA)
    return [len(pedidos), confirmadas, len(compareceram), matricularam]


def alunos_ativos(turmas: list[Turma]) -> set[int]:
    return {m.aluno_id for t in turmas for m in t.matriculas if m.status == MatriculaStatus.ATIVA}


def alunos_novos(db: Session, point_id: int, inicio: date, fim: date) -> int:
    """Alunos cuja primeira matrícula no Point foi criada no período."""
    primeiras = (
        db.query(Matricula.aluno_id, func.min(Matricula.created_at))
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(Vinculo.point_id == point_id)
        .group_by(Matricula.aluno_id)
        .all()
    )
    return sum(1 for _, criada in primeiras if inicio <= criada.date() <= fim)


def experimentais_por_turma(db: Session, turma_ids: list[int], inicio: date, fim: date) -> dict[int, int]:
    return dict(
        db.query(SolicitacaoExperimental.turma_id, func.count(SolicitacaoExperimental.id))
        .filter(
            SolicitacaoExperimental.turma_id.in_(turma_ids),
            SolicitacaoExperimental.created_at >= datetime.combine(inicio, datetime.min.time()),
            SolicitacaoExperimental.created_at <= datetime.combine(fim, datetime.max.time()),
        )
        .group_by(SolicitacaoExperimental.turma_id)
        .all()
    )
