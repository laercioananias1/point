from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.caixa import LancamentoCaixa
from app.models.cobranca import Cobranca
from app.models.enums import CobrancaStatus, LancamentoTipo, MatriculaStatus, Role, VinculoStatus
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.relatorio import (
    PainelIndicadoresOut,
    PainelMapaLinhaOut,
    PainelOrigemOut,
    PainelProfessorOut,
    PainelRelatorioOut,
    RelatorioMesOut,
    RelatorioResumoOut,
)
from app.services import relatorios as rel

router = APIRouter(prefix="/relatorios", tags=["relatorios"])

MESES_NA_SERIE = 6


def _meses_da_serie(hoje: date) -> list[date]:
    """Primeiro dia dos últimos MESES_NA_SERIE meses, do mais antigo ao
    mês corrente."""
    ano, mes = hoje.year, hoje.month
    meses = []
    for _ in range(MESES_NA_SERIE):
        meses.append(date(ano, mes, 1))
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
    return list(reversed(meses))


def _soma_caixa(db: Session, point_id: int, tipo: LancamentoTipo, *filtros) -> float:
    total = (
        db.query(func.coalesce(func.sum(LancamentoCaixa.valor), 0))
        .filter(LancamentoCaixa.point_id == point_id, LancamentoCaixa.tipo == tipo, *filtros)
        .scalar()
    )
    return float(total)


@router.get("/resumo", response_model=RelatorioResumoOut)
def resumo(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> RelatorioResumoOut:
    """Números da tela Relatórios (pedido do usuário, 2026-09-20: "faça um
    relatório, tendo esse como ideia") — a saúde do Point num relance:
    quantos alunos/turmas, quanto entrou no mês, inadimplência, série de 6
    meses de receita x despesa e o acumulado do Caixa + Cobranças."""
    point_id = admin.point_id
    hoje = date.today()

    alunos_ativos_ids = {
        aluno_id
        for (aluno_id,) in db.query(Matricula.aluno_id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(Vinculo.point_id == point_id, Matricula.status == MatriculaStatus.ATIVA)
        .distinct()
    }

    # Mesmo critério da lista de turmas do admin (GET /turmas?point_id=).
    turmas = (
        db.query(func.count(Turma.id))
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == point_id,
            Vinculo.status == VinculoStatus.ATIVO,
            or_(Turma.periodo_fim.is_(None), Turma.periodo_fim >= hoje),
        )
        .scalar()
    )

    inicio_mes = hoje.replace(day=1)
    recebido_mes = _soma_caixa(
        db, point_id, LancamentoTipo.ENTRADA, LancamentoCaixa.data >= inicio_mes
    )

    atrasadas = (
        db.query(Cobranca)
        .filter(
            Cobranca.point_id == point_id,
            Cobranca.status == CobrancaStatus.ABERTA,
            Cobranca.vencimento < hoje,
        )
        .all()
    )
    inadimplentes = {c.aluno_id for c in atrasadas} & alunos_ativos_ids
    inadimplencia_pct = (
        round(100 * len(inadimplentes) / len(alunos_ativos_ids), 1) if alunos_ativos_ids else 0.0
    )

    meses = _meses_da_serie(hoje)
    linhas = (
        db.query(LancamentoCaixa.tipo, LancamentoCaixa.data, LancamentoCaixa.valor)
        .filter(LancamentoCaixa.point_id == point_id, LancamentoCaixa.data >= meses[0])
        .all()
    )
    serie = {m: [0.0, 0.0] for m in meses}
    for tipo, data, valor in linhas:
        chave = data.replace(day=1)
        if chave in serie:
            serie[chave][0 if tipo == LancamentoTipo.ENTRADA else 1] += float(valor)

    entrou = _soma_caixa(db, point_id, LancamentoTipo.ENTRADA)
    saiu = _soma_caixa(db, point_id, LancamentoTipo.SAIDA)
    a_receber = float(
        db.query(func.coalesce(func.sum(Cobranca.valor), 0))
        .filter(Cobranca.point_id == point_id, Cobranca.status == CobrancaStatus.ABERTA)
        .scalar()
    )

    return RelatorioResumoOut(
        alunos_ativos=len(alunos_ativos_ids),
        turmas=turmas or 0,
        recebido_mes=recebido_mes,
        alunos_inadimplentes=len(inadimplentes),
        inadimplencia_pct=inadimplencia_pct,
        serie_mensal=[
            RelatorioMesOut(mes=m.strftime("%Y-%m"), receita=v[0], despesa=v[1])
            for m, v in serie.items()
        ],
        entrou=entrou,
        saiu=saiu,
        a_receber=a_receber,
        atrasado=sum(float(c.valor) for c in atrasadas),
        saldo=entrou - saiu,
    )


@router.get("/painel", response_model=PainelRelatorioOut)
def painel(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    periodo: Literal["semana", "mes", "trimestre"] = "mes",
) -> PainelRelatorioOut:
    """Painel do protótipo de Relatórios (pedido do usuário, 2026-10-01) —
    indicadores do período com comparação ao anterior, mapa de ocupação dia
    × hora, receita por origem, funil da aula experimental e desempenho por
    professor. Regras e limitações em app/services/relatorios.py."""
    point_id = admin.point_id
    hoje = date.today()
    inicio, fim = rel.intervalo(periodo, hoje)
    ant_inicio, ant_fim = rel.intervalo_anterior(periodo, inicio)

    turmas = rel.turmas_do_point(db, point_id)
    turma_ids = [t.id for t in turmas]
    atual = rel.ocorrencias(db, point_id, turmas, inicio, fim)
    anterior = rel.ocorrencias(db, point_id, turmas, ant_inicio, ant_fim)

    funil = rel.funil_experimental(db, turma_ids, point_id, inicio, fim)
    funil_ant = rel.funil_experimental(db, turma_ids, point_id, ant_inicio, ant_fim)

    def conversao(f: list[int]) -> int | None:
        return round(100 * f[3] / f[0]) if f[0] else None

    # Mapa dia × hora: ocupação média das ocorrências daquela célula.
    horas = sorted({int(t.horario[:2]) for t in turmas})
    soma: dict[tuple[int, int], list[int]] = {}
    for o in atual.ocorrencias:
        chave = (o.data.weekday(), int(o.turma.horario[:2]))
        acc = soma.setdefault(chave, [0, 0])
        acc[0] += min(o.inscritos, o.turma.capacidade)
        acc[1] += o.turma.capacidade
    celula = {k: round(100 * v[0] / v[1]) for k, v in soma.items() if v[1]}
    mapa = [
        PainelMapaLinhaOut(dia=rel.ROTULO_DIA[d], celulas=[celula.get((d, h)) for h in horas])
        for d in range(7)
        if any((d, h) in celula for h in horas)
    ]
    sugestao = None
    if celula:
        (d_min, h_min), v_min = min(celula.items(), key=lambda kv: kv[1])
        (d_max, h_max), v_max = max(celula.items(), key=lambda kv: kv[1])
        if v_max >= 90:
            sugestao = (
                f"{rel.ROTULO_DIA[d_max]} às {h_max}h está com {v_max}% de ocupação — "
                "dá pra abrir outra turma nesse horário."
            )
        elif v_min <= 40:
            sugestao = f"{rel.ROTULO_DIA[d_min]} às {h_min}h tem espaço sobrando ({v_min}% de ocupação)."

    plataformas = rel.checkins_plataformas(db, point_id, inicio, fim)

    exp_por_turma = rel.experimentais_por_turma(db, turma_ids, inicio, fim)
    por_vinculo: dict[int, list[Turma]] = {}
    for t in turmas:
        por_vinculo.setdefault(t.vinculo_id, []).append(t)
    professores = []
    for turmas_v in por_vinculo.values():
        ids = {t.id for t in turmas_v}
        ocs = [o for o in atual.ocorrencias if o.turma.id in ids]
        professores.append(
            PainelProfessorOut(
                nome=turmas_v[0].vinculo.professor.nome,
                modalidades=" · ".join(sorted({t.modalidade.nome for t in turmas_v})),
                aulas_dadas=sum(1 for o in ocs if o.data < hoje),
                alunos_ativos=len(rel.alunos_ativos(turmas_v)),
                experimentais=sum(exp_por_turma.get(i, 0) for i in ids),
                faltas=rel.faltas_pct(ocs, hoje),
                ocupacao=rel.ocupacao_pct(ocs),
            )
        )
    professores.sort(key=lambda p: (-(p.ocupacao or 0), p.nome))

    return PainelRelatorioOut(
        periodo=periodo,
        inicio=inicio.isoformat(),
        fim=fim.isoformat(),
        indicadores=PainelIndicadoresOut(
            receita=rel.receita(db, point_id, inicio, fim),
            receita_anterior=rel.receita(db, point_id, ant_inicio, ant_fim),
            ocupacao=rel.ocupacao_pct(atual.ocorrencias),
            ocupacao_anterior=rel.ocupacao_pct(anterior.ocorrencias),
            alunos_ativos=len(rel.alunos_ativos(turmas)),
            alunos_novos=rel.alunos_novos(db, point_id, inicio, fim),
            alunos_novos_anterior=rel.alunos_novos(db, point_id, ant_inicio, ant_fim),
            conversao=conversao(funil),
            conversao_anterior=conversao(funil_ant),
            faltas=rel.faltas_pct(atual.ocorrencias, hoje),
            faltas_anterior=rel.faltas_pct(anterior.ocorrencias, hoje),
        ),
        horas=[f"{h:02d}h" for h in horas],
        mapa=mapa,
        sugestao=sugestao,
        receita_origem=[
            PainelOrigemOut(rotulo=r, valor=v) for r, v in rel.receita_por_origem(db, point_id, inicio, fim)
        ],
        checkins_wellhub=plataformas.get("wellhub", 0),
        checkins_totalpass=plataformas.get("totalpass", 0),
        funil=funil,
        professores=professores,
    )
