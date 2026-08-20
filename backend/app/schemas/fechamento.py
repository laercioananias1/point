from datetime import date

from app.schemas.common import ORMModel


class FechamentoCreate(ORMModel):
    periodo_inicio: date
    periodo_fim: date


class RepasseFechamentoOut(ORMModel):
    professor_id: int
    professor_nome: str
    valor: float


class FechamentoOut(ORMModel):
    id: int
    point_id: int
    periodo_inicio: date
    periodo_fim: date
    taxa_servico_unitaria: float
    quantidade_pagamentos: int
    total_taxa_servico: float
    repasses: list[RepasseFechamentoOut]
