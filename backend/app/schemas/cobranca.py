from datetime import date

from pydantic import Field

from app.models.enums import CobrancaStatus
from app.schemas.common import ORMModel


class CobrancaCreate(ORMModel):
    aluno_id: int
    descricao: str = Field(min_length=1, max_length=120)
    valor: float = Field(gt=0)
    vencimento: date


class CobrancaUpdate(ORMModel):
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    valor: float | None = Field(default=None, gt=0)
    vencimento: date | None = None


class CobrancaOut(ORMModel):
    id: int
    aluno_id: int
    aluno_nome: str
    descricao: str
    valor: float
    vencimento: date
    status: CobrancaStatus
    atrasada: bool
    pago_em: date | None
    recorrente: bool
    turma_ids: list[int]
    # Último lembrete mandado (régua ou botão) — a tela mostra "Lembrado".
    ultimo_lembrete_em: date | None
    # Pagamento online (pedido do usuário, 2026-10-02): código do link
    # /pagar/<token> e "pix" quando o gateway deu a baixa.
    pagamento_token: str
    pago_via: str | None = None


class CobrancaAlunoOut(ORMModel):
    id: int
    nome: str


class MensalidadesGeradasOut(ORMModel):
    criadas: int


class ReguaEtapaOut(ORMModel):
    """Uma etapa da régua de cobrança (pedido do usuário, 2026-10-01)."""

    dias: int
    titulo: str
    descricao: str
    ativa: bool


class ReguaCobrancaOut(ORMModel):
    etapas: list[ReguaEtapaOut]
    # Cobranças em aberto que a régua mandaria hoje (com as etapas ligadas).
    hoje: int


class ReguaCobrancaIn(ORMModel):
    dias: list[int]
