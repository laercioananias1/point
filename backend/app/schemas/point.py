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


class AdminPointCreate(ORMModel):
    """Convite do dono do app para o admin de um Point específico."""

    nome: str
    celular: str
    email: str | None = None
    senha: str
