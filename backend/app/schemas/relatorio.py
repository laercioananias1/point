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


# --- Painel de Relatórios (design/telas/Relatorios.dc.html — pedido do
# usuário, 2026-10-01). Percentuais inteiros; None = sem dado pra calcular.


class PainelIndicadoresOut(ORMModel):
    receita: float
    receita_anterior: float
    ocupacao: int | None
    ocupacao_anterior: int | None
    alunos_ativos: int
    alunos_novos: int
    alunos_novos_anterior: int
    conversao: int | None
    conversao_anterior: int | None
    faltas: int | None
    faltas_anterior: int | None


class PainelMapaLinhaOut(ORMModel):
    dia: str
    # Uma por hora de `horas`; None = sem turma nesse dia/hora.
    celulas: list[int | None]


class PainelOrigemOut(ORMModel):
    rotulo: str
    valor: float


class PainelProfessorOut(ORMModel):
    nome: str
    modalidades: str
    aulas_dadas: int
    alunos_ativos: int
    experimentais: int
    faltas: int | None
    ocupacao: int | None


class PainelRelatorioOut(ORMModel):
    periodo: str
    inicio: str
    fim: str
    indicadores: PainelIndicadoresOut
    horas: list[str]
    mapa: list[PainelMapaLinhaOut]
    sugestao: str | None
    receita_origem: list[PainelOrigemOut]
    checkins_wellhub: int
    checkins_totalpass: int
    # [pedidos, confirmadas, compareceram, se matricularam]
    funil: list[int]
    professores: list[PainelProfessorOut]
