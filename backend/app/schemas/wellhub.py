from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ORMModel

Plataforma = Literal["wellhub", "totalpass"]


class WellhubCheckinCreate(ORMModel):
    """Check-in manual (pedido do usuário, 2026-09-22) — o admin digita o
    que o aluno mostra no app da plataforma: Gympass ID (13 dígitos) na
    Wellhub, código do dia na TotalPass."""

    plataforma: Plataforma = "wellhub"
    gympass_id: str = Field(min_length=1, max_length=32)


class CheckinVincular(ORMModel):
    """Vínculo manual de uma pessoa (todos os check-ins dela na
    plataforma) a um Aluno."""

    plataforma: Plataforma
    gympass_id: str = Field(min_length=1, max_length=32)
    aluno_id: int


class WellhubCheckinOut(ORMModel):
    id: int
    plataforma: str
    gympass_id: str
    aluno_id: int | None
    aluno_nome: str | None
    email_wellhub: str | None
    telefone_wellhub: str | None
    data: date
    origem: str
    # Quando foi registrado aqui (UTC, sem fuso) — mostra a hora no card.
    created_at: datetime


class AlunoWellhubUpdate(ORMModel):
    """None remove a ligação (pedido do usuário, 2026-09-29: liga o
    gympass_id a um Aluno cadastrado pra entrar no acerto do mês)."""

    gympass_id: str | None = Field(default=None, max_length=20)


class WellhubReconciliacaoLinha(ORMModel):
    """Uma linha do 'acerto do mês' (pedido do usuário, 2026-09-29:
    "trabalhar com saldos de checkin e qtde aulas feitas, pra ter um
    acerto no final do mes") — puramente informativo, não trava nada."""

    plataforma: str
    # Nulo quando a linha só existe pelo lado das aulas (aluno frequentando
    # com matrícula paga pela plataforma, mas sem identificador vinculado
    # ainda — não dá pra saber quantos check-ins ele fez de fato).
    gympass_id: str | None
    aluno_id: int | None
    aluno_nome: str | None
    checkins_no_mes: int
    aulas_no_mes: int
    # check-ins - aulas; negativo = precisa fazer mais check-in.
    saldo: int


class WellhubReconciliacaoOut(ORMModel):
    mes: str
    linhas: list[WellhubReconciliacaoLinha]
