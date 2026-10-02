from datetime import date, datetime

from app.models.enums import CobrancaStatus
from app.schemas.common import ORMModel


class PagamentoPublicoOut(ORMModel):
    """Página pública /pagar/<token> (pedido do usuário, 2026-10-02) —
    abre sem login, então só o necessário pra pagar: nada de e-mail,
    celular ou outras cobranças do aluno."""

    point_nome: str
    point_logo: str | None
    aluno_nome: str
    descricao: str
    valor: float
    vencimento: date
    status: CobrancaStatus
    atrasada: bool
    pago_em: date | None
    pago_via: str | None
    # Point com gateway ligado — sem isso a tela manda falar com o Point.
    pagamento_online: bool
    gateway_rotulo: str | None
    # Pix atual (só enquanto a cobrança está aberta e já foi gerado).
    pix_copia_cola: str | None = None
    pix_qr_base64: str | None = None
    pix_expira_em: datetime | None = None
    # Reserva de aula avulsa: prazo pra pagar (depois a vaga é solta).
    pagar_ate: datetime | None = None
    reserva: bool = False


class CobrancaDoAlunoOut(ORMModel):
    """Cobranças do próprio aluno, em qualquer Point (tela Pagamentos)."""

    id: int
    point_nome: str
    descricao: str
    valor: float
    vencimento: date
    status: CobrancaStatus
    atrasada: bool
    pago_em: date | None
    pago_via: str | None
    pagamento_token: str
    pagamento_online: bool


class PagamentoOnlineConfigOut(ORMModel):
    """Configuração de pagamento online do Point — a credencial nunca sai
    daqui, só se está ligada e qual conta."""

    gateway: str | None
    gateway_rotulo: str | None
    conta: str | None
    ativo: bool
    # Gateways que dá pra escolher hoje (só Mercado Pago, por enquanto).
    gateways_disponiveis: list[dict[str, str]]


class PagamentoOnlineConfigIn(ORMModel):
    gateway: str
    credencial: str
