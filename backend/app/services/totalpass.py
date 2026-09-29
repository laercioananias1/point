"""Integração com a API da TotalPass (pedido do usuário, 2026-08-25: "quero
fazer integração com totalpass... a integração que gostaria é de aceitar os
checkins"). Cobre só check-in "livre": o aluno TotalPass mostra na
recepção o código do dia gerado no app deles, o professor ou o admin do
Point digita aqui na hora — decisão do usuário ("check-in livre, sem
reserva"), sem precisar de matrícula nem agendamento prévio na plataforma.

Credenciais, confirmadas na doc oficial (dev.totalpass.com, 2026-08-25):
- `partner_api_key` é da plataforma inteira (Settings.totalpass_partner_api_key)
  — não é self-service, se consegue com o time de parceiros/academias da
  TotalPass (contato comercial, não um cadastro de developer).
- `place_api_key` é POR Point (Point.place_api_key — campo que já existia
  reservado no modelo desde a seção 5.4 do plano original) — cada Point
  pega o dele no portal deles, aba "Integrações".
- Dois ambientes: produção em `booking-api.totalpass.com` e staging em
  `booking-api.staging.totalpass.com` (Settings.totalpass_base_url, aponta
  pro staging por padrão). `POST /partner-auth` com os dois keys devolve
  um JWT válido por 24h.

IMPORTANTE — o que NÃO foi confirmado com a mesma certeza: o path exato do
endpoint de validação de check-in (`_ENDPOINT_VALIDAR_CHECKIN` abaixo) e o
formato exato do corpo da resposta (usado em `_extrair_beneficiario`). A
referência completa da TotalPass fica atrás de login no portal deles
(dev.totalpass.com exige "Get Started"/conta); o que se viu publicamente
descreve o conceito (endpoint que recebe o código do aluno e libera a
entrada) mas não o contrato byte a byte. Quando as credenciais reais
chegarem, confirme esses dois pontos contra a referência de vocês lá e
ajuste aqui — o resto (auth, cache de token, tratamento de erro) já segue
o contrato documentado."""

from datetime import datetime, timedelta

import httpx

from app.core.config import get_settings
from app.services.integracao_logs import registrar_em_sessao_propria

_ENDPOINT_AUTH = "/partner-auth"
# TODO(confirmar contra a referência real, ver docstring do módulo).
_ENDPOINT_VALIDAR_CHECKIN = "/track-usages/validate"

# JWT por Point, em memória (pedido do usuário: evitar autenticar de novo a
# cada check-in — o token dura 24h). Como o resto do app (ex.: scheduler),
# assume processo único; não sobrevive a restart, o que é aceitável aqui
# (só reautentica na próxima chamada).
_cache_token: dict[int, tuple[str, datetime]] = {}


class TotalPassError(Exception):
    """Erro de negócio (código inválido, Point sem credencial, etc.) — a
    mensagem já vem pronta pra mostrar pro professor/admin que fez o
    check-in."""


def _autenticar(place_api_key: str, point_id: int) -> str:
    settings = get_settings()
    request_corpo = (
        f"POST {settings.totalpass_base_url}{_ENDPOINT_AUTH}\n"
        f'{{"partner_api_key": "(oculto)", "place_api_key": "{place_api_key}"}}'
    )
    if not settings.totalpass_partner_api_key:
        mensagem = "Integração TotalPass não configurada na plataforma (partner_api_key ausente)"
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="auth",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
        )
        raise TotalPassError(mensagem)

    try:
        resposta = httpx.post(
            f"{settings.totalpass_base_url}{_ENDPOINT_AUTH}",
            json={
                "partner_api_key": settings.totalpass_partner_api_key,
                "place_api_key": place_api_key,
            },
            timeout=10,
        )
    except httpx.HTTPError as erro:
        mensagem = f"Falha ao falar com a TotalPass: {erro}"
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="auth",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
        )
        raise TotalPassError(mensagem) from erro

    response_corpo = f"{resposta.status_code}\n{resposta.text}"
    if resposta.status_code != 200:
        mensagem = "Não foi possível autenticar com a TotalPass — confira o place_api_key do Point"
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="auth",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
        raise TotalPassError(mensagem)

    corpo = resposta.json() if resposta.content else {}
    token = corpo.get("access_token") or corpo.get("token")
    if not token:
        mensagem = "Resposta inesperada da TotalPass ao autenticar"
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="auth",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
        raise TotalPassError(mensagem)
    registrar_em_sessao_propria(
        integracao="totalpass",
        evento="auth",
        sucesso=True,
        mensagem="Autenticado",
        point_id=point_id,
        request_corpo=request_corpo,
        response_corpo=response_corpo,
    )
    return token


def _token_do_point(point_id: int, place_api_key: str) -> str:
    em_cache = _cache_token.get(point_id)
    if em_cache and em_cache[1] > datetime.utcnow():
        return em_cache[0]

    token = _autenticar(place_api_key, point_id)
    # Margem sobre as 24h reais documentadas — reautentica um pouco antes
    # de expirar de verdade, pra nunca usar um token vencido por segundos.
    _cache_token[point_id] = (token, datetime.utcnow() + timedelta(hours=23))
    return token


def validar_checkin(*, point_id: int, place_api_key: str, codigo: str) -> dict[str, str | None]:
    """Valida o código/token diário que o aluno TotalPass mostra na
    recepção. Devolve o que a TotalPass souber sobre o beneficiário
    (nome/documento), pra registrar no Checkin local — .get em tudo de
    propósito (best-effort): um campo a mais ou a menos no formato real da
    resposta não pode derrubar um check-in que já foi validado do lado
    deles. Loga toda chamada (pedido do usuário, 2026-09-29: "quero ver
    tb o request e response") — `_autenticar` acima loga o próprio passo
    de login, separado do check-in em si aqui."""
    token = _token_do_point(point_id, place_api_key)
    settings = get_settings()
    request_corpo = (
        f"POST {settings.totalpass_base_url}{_ENDPOINT_VALIDAR_CHECKIN}\n"
        f'{{"token": "{codigo}"}}'
    )

    try:
        resposta = httpx.post(
            f"{settings.totalpass_base_url}{_ENDPOINT_VALIDAR_CHECKIN}",
            headers={"Authorization": f"Bearer {token}"},
            json={"token": codigo},
            timeout=10,
        )
    except httpx.HTTPError as erro:
        mensagem = f"Falha ao falar com a TotalPass: {erro}"
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="validate",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
        )
        raise TotalPassError(mensagem) from erro

    response_corpo = f"{resposta.status_code}\n{resposta.text}"

    def _falhar(mensagem: str) -> None:
        registrar_em_sessao_propria(
            integracao="totalpass",
            evento="validate",
            sucesso=False,
            mensagem=mensagem,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
        raise TotalPassError(mensagem)

    if resposta.status_code == 401:
        # Token pode ter expirado antes da hora (ou sido revogado do lado
        # deles) — descarta o cache pra reautenticar na próxima tentativa,
        # em vez de continuar falhando com o mesmo token ruim.
        _cache_token.pop(point_id, None)
        _falhar("Sessão com a TotalPass expirou — tente novamente")
    if resposta.status_code == 422:
        _falhar("Código inválido, expirado ou já utilizado")
    if resposta.status_code >= 400:
        _falhar(f"TotalPass recusou o check-in (HTTP {resposta.status_code})")

    corpo = resposta.json() if resposta.content else {}
    beneficiario = corpo.get("beneficiary") or corpo.get("beneficiario") or {}
    resultado = {
        "nome": beneficiario.get("name") or corpo.get("name"),
        "documento": beneficiario.get("document") or corpo.get("document"),
    }
    registrar_em_sessao_propria(
        integracao="totalpass",
        evento="validate",
        sucesso=True,
        mensagem="Check-in validado",
        point_id=point_id,
        request_corpo=request_corpo,
        response_corpo=response_corpo,
    )
    return resultado
