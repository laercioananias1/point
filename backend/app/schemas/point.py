from app.schemas.common import ORMModel


class PointCreate(ORMModel):
    nome: str
    endereco: str
    prazo_credito_dias: int = 30


class PointOut(ORMModel):
    id: int
    nome: str
    endereco: str
    formas_pagamento_habilitadas: list[str]
    prazo_credito_dias: int


class PointResumo(ORMModel):
    """Versão enxuta para o professor escolher um Point ao solicitar vínculo —
    sem expor formas_pagamento_habilitadas/prazo_credito_dias, que são dados
    de gestão do Point."""

    id: int
    nome: str
    endereco: str


class AdminPointCreate(ORMModel):
    """Convite do dono do app para o admin de um Point específico."""

    nome: str
    celular: str
    email: str | None = None
    senha: str


class PointRankingOut(ORMModel):
    """Dashboard comparativo entre Points, só pro dono do app (seção 6.5)."""

    point_id: int
    nome: str
    professores_ativos: int
    alunos_ativos: int
    total_taxa_servico: float
    total_repassado: float
