"""Gateways de pagamento online (pedido do usuário, 2026-10-02: Pix pelo
app, dinheiro direto na conta de cada Point — "amanhã posso ter outros
conectores para pagamento como Asaas, mas por enquanto só Mercado Pago").

Cada gateway implementa a mesma interface (`GatewayPix`); o resto do
sistema (app/services/pix_cobranca.py, routers) só fala com ela. Pra
plugar um gateway novo: uma classe aqui no pacote + registrar em
GATEWAYS + o webhook dele em app/routers/webhooks.py."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol


class GatewayErro(Exception):
    """Falha falando com o gateway (credencial inválida, fora do ar...).
    A mensagem já vem pronta pra mostrar na tela."""


@dataclass
class PixCriado:
    pagamento_id: str
    copia_cola: str
    qr_base64: str
    expira_em: datetime


StatusPagamento = Literal["pendente", "pago", "cancelado"]


@dataclass
class PagamentoConsultado:
    pagamento_id: str
    status: StatusPagamento
    valor: float
    referencia: str | None


class GatewayPix(Protocol):
    nome: str
    rotulo: str

    def validar_credencial(self, credencial: str, *, point_id: int | None = None) -> str:
        """Confere a credencial e devolve o nome/e-mail da conta."""
        ...

    def criar_pix(
        self,
        credencial: str,
        *,
        valor: float,
        descricao: str,
        referencia: str,
        pagador_nome: str,
        pagador_email: str,
        expira_em: datetime,
        notificacao_url: str | None,
        point_id: int | None = None,
    ) -> PixCriado: ...

    def consultar(self, credencial: str, pagamento_id: str, *, point_id: int | None = None) -> PagamentoConsultado: ...


def _registro() -> dict[str, GatewayPix]:
    from app.services.gateways.mercadopago import MercadoPago

    return {g.nome: g for g in (MercadoPago(),)}


GATEWAYS: dict[str, GatewayPix] = _registro()


def gateway(nome: str | None) -> GatewayPix | None:
    return GATEWAYS.get(nome or "")
