"""Integração com a Access Control API da Wellhub (ex-Gympass) — mesmo
desenho da TotalPass (app/services/totalpass.py), API diferente.

Credenciais, confirmadas com o time de parceiros da Wellhub (protocolo
15968485, resposta em 2026-09-22 via marco.ende@gympass.com — ver também
developers.wellhub.com/product/access-control-api/1.0):
- Auth Token: diferente da TotalPass, não tem endpoint de login — a
  Wellhub entrega um Bearer Token estático pronto ("api_key" no e-mail
  deles), da plataforma inteira (Settings.wellhub_auth_token). Sem cache/
  expiração pra gerenciar aqui.
- Gym ID: identifica a unidade (POR Point — Point.wellhub_gym_id), enviado
  no header `X-Gym-Id` em toda chamada.
- Dois ambientes: produção em `api.partners.gympass.com/access/v1`,
  sandbox em `apitesting.partners.gympass.com/access/v1`
  (Settings.wellhub_base_url, aponta pro sandbox por padrão).

Endpoint: `POST {base}/validate`, corpo `{"gympass_id": "<13 dígitos>"}` —
confirmado de verdade contra o sandbox em 2026-09-29 (token + gym_id 718
recebidos no protocolo 15968485): autenticação e Gym ID ok, erro de
negócio vem estruturado, ex. `{"errors": [{"key":
"checkin.validation.notfound", "message": "Check-In not found in
database"}]}` com HTTP 404 — é o caso comum (gympass_id sem check-in
pendente feito no app antes), não "Gym ID errado" como a doc pública
sozinha sugeria. Ainda não visto: o corpo de uma validação COM SUCESSO
(precisa de um check-in de verdade simulado do lado da Wellhub pra
testar) — o parsing abaixo continua best-effort até confirmar.

Desenho de negócio (pedido do usuário, 2026-09-29: "vincular sempre um
checkin com uma aula vai ficar complicado... ele fica com um saldo de
checkin para usar nas aulas") — a Wellhub só permite 1 check-in por dia
POR USUÁRIO, sem nenhuma noção de "turma"/horário de aula; um aluno pode
fazer check-in todo dia e só frequentar 2 aulas de beach tennis na semana.
Por isso um check-in validado NÃO vira um Checkin(turma_id=...) — vira uma
linha em WellhubCheckin (app/models/wellhub_checkin.py), um log solto por
Point+dia. "Aulas feitas" continua sendo a presença normal que já existe
pra qualquer aluno matriculado (fonte_pagamento=wellhub); o "acerto do
mês" (ver GET /wellhub/reconciliacao) só compara as duas contagens, sem
travar nada — é informativo, não uma trava de saldo."""

import httpx

from app.core.config import get_settings
from app.services.integracao_logs import registrar_em_sessao_propria

_ENDPOINT_VALIDAR = "/validate"


class WellhubError(Exception):
    """Erro de negócio (gympass_id inválido, Point sem credencial, etc.) —
    a mensagem já vem pronta pra mostrar pro professor/admin que fez o
    check-in."""


def validar_checkin(
    *, gym_id: str, gympass_id: str, point_id: int | None = None
) -> dict[str, str | None]:
    """Único lugar que fala de verdade com a Access Control API da
    Wellhub — chamado tanto pelo check-in manual quanto pelo webhook
    automático (routers/wellhub.py e routers/webhooks.py). Loga toda
    chamada (pedido do usuário, 2026-09-29: "quero ver tb o request e
    response") — `point_id` é opcional só pra enriquecer o log quando
    quem chama já tem o Point em mãos; a Wellhub em si só conhece o
    gym_id."""
    settings = get_settings()
    url = f"{settings.wellhub_base_url}{_ENDPOINT_VALIDAR}"
    request_corpo = f'POST {url}\nX-Gym-Id: {gym_id}\n{{"gympass_id": "{gympass_id}"}}'

    if not settings.wellhub_auth_token:
        mensagem = "Integração Wellhub não configurada na plataforma (auth_token ausente)"
        registrar_em_sessao_propria(
            integracao="wellhub",
            evento="validate",
            sucesso=False,
            mensagem=mensagem,
            destino=gympass_id,
            point_id=point_id,
            request_corpo=request_corpo,
        )
        raise WellhubError(mensagem)

    try:
        resposta = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.wellhub_auth_token}",
                "X-Gym-Id": gym_id,
            },
            json={"gympass_id": gympass_id},
            timeout=10,
        )
    except httpx.HTTPError as erro:
        mensagem = f"Falha ao falar com a Wellhub: {erro}"
        registrar_em_sessao_propria(
            integracao="wellhub",
            evento="validate",
            sucesso=False,
            mensagem=mensagem,
            destino=gympass_id,
            point_id=point_id,
            request_corpo=request_corpo,
        )
        raise WellhubError(mensagem) from erro

    response_corpo = f"{resposta.status_code}\n{resposta.text}"

    def _falhar(mensagem: str) -> None:
        registrar_em_sessao_propria(
            integracao="wellhub",
            evento="validate",
            sucesso=False,
            mensagem=mensagem,
            destino=gympass_id,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
        raise WellhubError(mensagem)

    if resposta.status_code == 401:
        _falhar("Credencial Wellhub recusada — confira o token da plataforma")
    if resposta.status_code == 403:
        # Formato de erro diferente do resto (chave "Message" maiúscula,
        # sem "errors[]") — visto na prática, 2026-09-29: rejeição de
        # infraestrutura (estilo IAM), não erro de negócio do check-in em
        # si. O token de sandbox parece vir amarrado a um Gym ID
        # específico — confirmar se em produção é assim também (um token
        # por unidade) ou só uma restrição do ambiente de teste.
        _falhar("Wellhub recusou o Gym ID desse Point pra essa credencial")
    if resposta.status_code >= 400:
        corpo_erro = resposta.json() if resposta.content else {}
        erros = corpo_erro.get("errors") or []
        chave = erros[0].get("key") if erros else None
        mensagem = erros[0].get("message") if erros else None
        if chave == "checkin.already.validated":
            # Reentrega do webhook ou validação já feita por outro caminho:
            # o check-in existe e é válido, só não dá pra validar duas vezes.
            registrar_em_sessao_propria(
                integracao="wellhub",
                evento="validate",
                sucesso=True,
                mensagem="Check-in já estava validado na Wellhub",
                destino=gympass_id,
                point_id=point_id,
                request_corpo=request_corpo,
                response_corpo=response_corpo,
            )
            return {"nome": None, "documento": gympass_id}
        if chave == "checkin.validation.notfound":
            _falhar(
                "Esse aluno ainda não fez check-in pelo app da Wellhub hoje (ou já expirou) —"
                " confira o Gympass ID"
            )
        _falhar(
            mensagem or corpo_erro.get("Message") or f"Wellhub recusou o check-in (HTTP {resposta.status_code})"
        )

    # Formato real (sandbox, 2026-09-30): {"metadata": {...}, "results":
    # {"user": {"gympass_id"}, "gym": {...}, "validated_at"}} — sem nome;
    # o nome vem do evento do webhook.
    corpo = resposta.json() if resposta.content else {}
    usuario = (corpo.get("results") or {}).get("user") or {}
    resultado = {
        "nome": usuario.get("name"),
        "documento": usuario.get("gympass_id") or gympass_id,
    }
    registrar_em_sessao_propria(
        integracao="wellhub",
        evento="validate",
        sucesso=True,
        mensagem="Check-in validado",
        destino=gympass_id,
        point_id=point_id,
        request_corpo=request_corpo,
        response_corpo=response_corpo,
    )
    return resultado
