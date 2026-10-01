from app.schemas.common import ORMModel


class PlataformaTotaisOut(ORMModel):
    """Números da plataforma inteira (pedido do usuário, 2026-10-01)."""

    points: int
    points_novos_mes: int
    alunos: int
    alunos_novos_mes: int
    professores: int
    recebido_mes: float
    recebido_mes_anterior: float
    # Check-ins Wellhub/TotalPass registrados no mês.
    checkins_mes: int
    experimentais_mes: int
    experimentais_pendentes: int


class PlataformaPointOut(ORMModel):
    id: int
    nome: str
    criado_em: str
    admins: int
    professores: int
    alunos: int
    turmas: int
    recebido_mes: float
    recebido_mes_anterior: float


class PlataformaIntegracaoOut(ORMModel):
    integracao: str
    total_24h: int
    erros_24h: int
    ultimo_erro_em: str | None
    ultimo_erro: str | None


class PlataformaPainelOut(ORMModel):
    totais: PlataformaTotaisOut
    points: list[PlataformaPointOut]
    integracoes: list[PlataformaIntegracaoOut]
