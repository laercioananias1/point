from app.schemas.common import ORMModel


class RelatorioMesOut(ORMModel):
    """Um mês da série Receita x Despesa — `mes` no formato "2026-09"."""

    mes: str
    receita: float
    despesa: float


class RelatorioResumoOut(ORMModel):
    alunos_ativos: int
    turmas: int
    # Entradas do Caixa no mês corrente.
    recebido_mes: float
    # Alunos ativos com pelo menos uma cobrança vencida e em aberto.
    alunos_inadimplentes: int
    inadimplencia_pct: float

    serie_mensal: list[RelatorioMesOut]

    # Acumulado (desde sempre), direto do Caixa e das Cobranças.
    entrou: float
    saiu: float
    a_receber: float
    atrasado: float
    saldo: float
