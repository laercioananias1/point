"""Mercado Pago (pedido do usuário, 2026-10-02) — Pix pela API de
Pagamentos (/v1/payments com payment_method_id "pix"), na conta do próprio
Point: a credencial é o Access Token de produção da conta MP da arena.

Referência: mercadopago.com.br/developers/pt/reference/payments/_payments/post"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.services.gateways import GatewayErro, PagamentoConsultado, PixCriado, StatusPagamento
from app.services.integracao_logs import registrar_em_sessao_propria

_FUSO_BRASILIA = timezone(timedelta(hours=-3))

# Status do MP -> nosso. "authorized"/"in_process"/"in_mediation" seguem
# pendentes; estornos e recusas contam como cancelado.
_STATUS: dict[str, StatusPagamento] = {
    "approved": "pago",
    "pending": "pendente",
    "authorized": "pendente",
    "in_process": "pendente",
    "in_mediation": "pendente",
    "rejected": "cancelado",
    "cancelled": "cancelado",
    "refunded": "cancelado",
    "charged_back": "cancelado",
}


class MercadoPago:
    nome = "mercadopago"
    rotulo = "Mercado Pago"

    def _chamar(
        self,
        metodo: str,
        caminho: str,
        credencial: str,
        *,
        evento: str,
        corpo: dict | None = None,
        point_id: int | None = None,
    ) -> dict:
        url = f"{get_settings().mercadopago_base_url}{caminho}"
        headers = {"Authorization": f"Bearer {credencial}"}
        if metodo == "POST":
            headers["X-Idempotency-Key"] = str(uuid.uuid4())
        # Pro log: nunca o header Authorization, só o corpo.
        request_corpo = f"{metodo} {url}" + (f"\n{json.dumps(corpo, ensure_ascii=False, indent=2)}" if corpo else "")
        try:
            resposta = httpx.request(metodo, url, headers=headers, json=corpo, timeout=15)
        except httpx.HTTPError as erro:
            registrar_em_sessao_propria(
                integracao="mercadopago",
                evento=evento,
                sucesso=False,
                mensagem=str(erro),
                point_id=point_id,
                request_corpo=request_corpo,
            )
            raise GatewayErro("Não foi possível falar com o Mercado Pago. Tente de novo.") from erro

        # O corpo do QR Code em base64 é grande e não ajuda no log.
        texto = resposta.text
        if '"qr_code_base64"' in texto:
            try:
                dados = resposta.json()
                dados.get("point_of_interaction", {}).get("transaction_data", {})["qr_code_base64"] = "(omitido)"
                texto = json.dumps(dados, ensure_ascii=False)
            except (ValueError, AttributeError, TypeError):
                pass
        sucesso = resposta.status_code < 400
        registrar_em_sessao_propria(
            integracao="mercadopago",
            evento=evento,
            sucesso=sucesso,
            mensagem="OK" if sucesso else f"HTTP {resposta.status_code}",
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=f"{resposta.status_code}\n{texto}",
        )
        if resposta.status_code in (401, 403):
            raise GatewayErro("Access Token do Mercado Pago inválido ou sem permissão.")
        if not sucesso:
            try:
                detalhe = resposta.json().get("message") or ""
            except ValueError:
                detalhe = ""
            # Conta sem chave Pix (pedido do usuário, 2026-10-02: o erro
            # veio cru, em inglês, na compra de aula avulsa).
            if "without key enabled" in detalhe:
                raise GatewayErro(
                    "A conta do Mercado Pago deste Point ainda não tem chave Pix cadastrada. "
                    "Avise a recepção — o pagamento online volta a funcionar assim que a chave for cadastrada."
                )
            raise GatewayErro(f"O Mercado Pago recusou a operação{': ' + detalhe if detalhe else ''}.")
        return resposta.json()

    def validar_credencial(self, credencial: str, *, point_id: int | None = None) -> str:
        dados = self._chamar("GET", "/users/me", credencial, evento="validar credencial", point_id=point_id)
        return str(dados.get("email") or dados.get("nickname") or dados.get("id") or "conta Mercado Pago")

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
    ) -> PixCriado:
        corpo: dict = {
            "transaction_amount": round(float(valor), 2),
            "description": descricao[:200],
            "payment_method_id": "pix",
            "external_reference": referencia,
            "payer": {"email": pagador_email, "first_name": pagador_nome.split(" ")[0][:60]},
            "date_of_expiration": expira_em.astimezone(_FUSO_BRASILIA).strftime("%Y-%m-%dT%H:%M:%S.000%z")[:-2]
            + ":00",
        }
        if notificacao_url:
            corpo["notification_url"] = notificacao_url
        dados = self._chamar("POST", "/v1/payments", credencial, evento="criar pix", corpo=corpo, point_id=point_id)
        transacao = (dados.get("point_of_interaction") or {}).get("transaction_data") or {}
        if not transacao.get("qr_code"):
            raise GatewayErro("O Mercado Pago não devolveu o código Pix. Confira se a conta aceita Pix.")
        return PixCriado(
            pagamento_id=str(dados["id"]),
            copia_cola=transacao["qr_code"],
            qr_base64=transacao.get("qr_code_base64") or "",
            expira_em=expira_em,
        )

    def consultar(self, credencial: str, pagamento_id: str, *, point_id: int | None = None) -> PagamentoConsultado:
        dados = self._chamar(
            "GET", f"/v1/payments/{pagamento_id}", credencial, evento="consultar pagamento", point_id=point_id
        )
        return PagamentoConsultado(
            pagamento_id=str(dados.get("id", pagamento_id)),
            status=_STATUS.get(str(dados.get("status")), "pendente"),
            valor=float(dados.get("transaction_amount") or 0),
            referencia=dados.get("external_reference"),
        )
