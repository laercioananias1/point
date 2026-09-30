"""Webhooks de parceiros externos — hoje só a Wellhub. Endpoint público (o
parceiro chama de fora, não tem usuário logado nem JWT nosso); a proteção é
a assinatura HMAC de cada request, não Depends(require_role(...)).
"""

import hashlib
import hmac
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.point import Point
from app.routers.wellhub import registrar_checkin
from app.services.integracao_logs import registrar as registrar_log
from app.services.wellhub import WellhubError, validar_checkin

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# Brasil sem horário de verão desde 2019 — offset fixo evita depender do
# tzdata no container (que roda em UTC).
_FUSO_BRASILIA = timezone(timedelta(hours=-3))


def _assinatura_valida(corpo: bytes, assinatura: str | None, segredo: str) -> bool:
    if not assinatura or not segredo:
        return False
    calculada = hmac.new(segredo.encode(), corpo, hashlib.sha1).hexdigest()
    return hmac.compare_digest(calculada.lower(), assinatura.strip().lower())


def _data_do_evento(timestamp_ms: object) -> date | None:
    try:
        return datetime.fromtimestamp(int(timestamp_ms) / 1000, tz=_FUSO_BRASILIA).date()
    except (TypeError, ValueError, OverflowError):
        return None


@router.post("/wellhub", status_code=200)
async def webhook_wellhub(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_gympass_signature: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Check-in automático via Wellhub (pedido do usuário, 2026-09-22/29,
    protocolo 15968485) — "o usuário faz check-in pelo app, a Wellhub avisa
    a gente por webhook, a gente chama /validate". Vira uma linha em
    WellhubCheckin (log solto por dia, sem turma — ver
    app/services/wellhub.py), não um Checkin de aula: o webhook não diz em
    qual aula o aluno vai, só que o benefício está ativo hoje.

    Sempre responde 200 quando a assinatura bate (mesmo sem achar nada pra
    fazer com o evento) — devolver erro faria a Wellhub reentregar o mesmo
    evento sem chance de dar certo.

    Formato confirmado pela simulação da coleção Postman da Wellhub
    (2026-09-30): {"event_type": "checkin", "event_data": {"user":
    {"unique_token", "first_name", "last_name", ...}, "gym": {"id", ...},
    "timestamp": <epoch ms>}}. `unique_token` é o Gympass ID de 13
    dígitos."""
    settings = get_settings()
    corpo_bruto = await request.body()

    if not _assinatura_valida(corpo_bruto, x_gympass_signature, settings.wellhub_webhook_secret):
        registrar_log(
            db,
            integracao="wellhub",
            evento="webhook_assinatura",
            sucesso=False,
            mensagem="Assinatura inválida ou segredo não configurado",
        )
        raise HTTPException(401, "Assinatura inválida")

    corpo = await request.json()
    if corpo.get("event_type") != "checkin":
        registrar_log(
            db,
            integracao="wellhub",
            evento="webhook_ignorado",
            sucesso=True,
            mensagem=f"Evento {corpo.get('event_type')!r} não tratado",
            response_corpo=corpo_bruto.decode(errors="replace"),
        )
        return {"status": "ignorado"}

    evento = corpo.get("event_data") or {}
    usuario = evento.get("user") or {}
    gym_id = str((evento.get("gym") or {}).get("id") or "")
    gympass_id = str(usuario.get("unique_token") or "")
    nome_evento = " ".join(p for p in (usuario.get("first_name"), usuario.get("last_name")) if p) or None
    data_checkin = _data_do_evento(evento.get("timestamp"))
    if not gym_id or not gympass_id:
        print(f"[wellhub] webhook com corpo inesperado: {corpo}")
        registrar_log(
            db,
            integracao="wellhub",
            evento="webhook_checkin",
            sucesso=False,
            mensagem=f"Corpo do webhook sem gym_id/gympass_id: {corpo}",
        )
        return {"status": "ignorado"}

    point = db.query(Point).filter(Point.wellhub_gym_id == gym_id).first()
    if point is None:
        print(f"[wellhub] webhook pra gym_id {gym_id} sem Point correspondente")
        registrar_log(
            db,
            integracao="wellhub",
            evento="webhook_checkin",
            sucesso=False,
            mensagem=f"Nenhum Point com wellhub_gym_id={gym_id}",
            destino=gympass_id,
        )
        return {"status": "ignorado"}

    try:
        # A chamada em si (evento "validate") já loga sucesso/erro sozinha
        # — ver services/wellhub.py.
        beneficiario = validar_checkin(gym_id=gym_id, gympass_id=gympass_id, point_id=point.id)
    except WellhubError as erro:
        print(f"[wellhub] falha ao validar check-in do Point {point.id}: {erro}")
        return {"status": "erro_ao_validar"}

    registrar_checkin(
        db,
        point_id=point.id,
        gympass_id=gympass_id,
        nome=beneficiario.get("nome") or nome_evento,
        origem="webhook",
        data=data_checkin,
    )
    return {"status": "registrado"}
