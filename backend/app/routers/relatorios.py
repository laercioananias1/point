from datetime import date
from typing import Annotated

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
from app.schemas.relatorio import RelatorioMesOut, RelatorioResumoOut

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
