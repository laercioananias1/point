from datetime import date

from pydantic import Field

from app.schemas.common import ORMModel


class WellhubCheckinCreate(ORMModel):
    """Check-in manual (pedido do usuário, 2026-09-22) — professor/admin
    digita o Gympass ID de 13 dígitos que aparece no app do aluno, sem
    precisar do webhook estar cadastrado ainda."""

    gympass_id: str = Field(min_length=1, max_length=20)


class WellhubCheckinOut(ORMModel):
    id: int
    gympass_id: str
    aluno_id: int | None
    aluno_nome: str | None
    data: date
    origem: str


class AlunoWellhubUpdate(ORMModel):
    """None remove a ligação (pedido do usuário, 2026-09-29: liga o
    gympass_id a um Aluno cadastrado pra entrar no acerto do mês)."""

    gympass_id: str | None = Field(default=None, max_length=20)


class WellhubReconciliacaoLinha(ORMModel):
    """Uma linha do 'acerto do mês' (pedido do usuário, 2026-09-29:
    "trabalhar com saldos de checkin e qtde aulas feitas, pra ter um
    acerto no final do mes") — puramente informativo, não trava nada."""

    # Nulo quando a linha só existe pelo lado das aulas (aluno com
    # fonte_pagamento=wellhub frequentando, mas sem gympass_id vinculado
    # ainda — não dá pra saber quantos check-ins ele fez de fato).
    gympass_id: str | None
    aluno_id: int | None
    aluno_nome: str | None
    checkins_no_mes: int
    aulas_no_mes: int


class WellhubReconciliacaoOut(ORMModel):
    mes: str
    linhas: list[WellhubReconciliacaoLinha]
