from app.schemas.common import ORMModel


class ModalidadeCreate(ORMModel):
    nome: str
    duracao_padrao_minutos: int = 60
    # Tabela de preço do Point pra essa modalidade (pedido do usuário,
    # 2026-08-21) — vale pra qualquer professor que der aula dela aqui.
    preco_avulso: float
    preco_plano: float


class ModalidadeUpdate(ORMModel):
    nome: str | None = None
    duracao_padrao_minutos: int | None = None
    preco_avulso: float | None = None
    preco_plano: float | None = None


class ModalidadeOut(ORMModel):
    id: int
    point_id: int
    nome: str
    duracao_padrao_minutos: int
    preco_avulso: float
    preco_plano: float
