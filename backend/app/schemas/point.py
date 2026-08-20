from app.schemas.common import ORMModel


class PointCreate(ORMModel):
    nome: str
    endereco: str
    quadras: list[str] = []
    prazo_credito_dias: int = 30


class PointOut(ORMModel):
    id: int
    nome: str
    endereco: str
    quadras: list[str]
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
