from datetime import datetime

from app.schemas.common import ORMModel


class HistoricoEventoOut(ORMModel):
    """Um evento de cancelamento pra tela de histórico (pedido do usuário,
    2026-09-01: "sim, inclusive coloca usuario q fez acao" / "e
    datahora") — junta 4 fontes diferentes (aula cancelada, matrícula
    cancelada, assinatura cancelada, crédito expirado) num formato só,
    porque pra quem tá vendo o histórico da agenda de um aluno, todos são
    a mesma pergunta: o que foi cancelado, quando, e por quem."""

    tipo: str  # "aula_cancelada" | "matricula_cancelada" | "assinatura_cancelada" | "credito_expirado"
    data_hora: datetime
    aluno_id: int
    aluno_nome: str
    modalidade_nome: str
    detalhe: str
    cancelado_por_nome: str | None = None
