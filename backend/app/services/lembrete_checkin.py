"""Lembrete automático de check-in (pedido do usuário, 2026-10-02: o site
promete "quem está com saldo negativo recebe um lembrete no WhatsApp").

Aluno de Wellhub/TotalPass com saldo negativo no mês (mais aulas com
presença confirmada do que check-ins) recebe WhatsApp + e-mail toda
segunda-feira e no dia 25 — dias fixos, então não precisa guardar quem já
recebeu: cada dia de lembrete manda uma vez só. Só nos Points que ligaram
o lembrete (Point.lembrete_checkin)."""

import calendar
from datetime import date

from sqlalchemy.orm import Session

from app.models.aluno import Aluno
from app.models.enums import MatriculaStatus
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.turma import Turma
from app.models.vinculo import Vinculo
from app.schemas.wellhub import SaldoAlunoOut
from app.services.saldo_checkins import PLATAFORMA_DO_MEIO, saldos_de_checkins

ROTULO_PLATAFORMA = {"wellhub": "Wellhub", "totalpass": "TotalPass"}
DIA_DO_MES = 25


def dia_de_lembrete(hoje: date) -> bool:
    return hoje.weekday() == 0 or hoje.day == DIA_DO_MES


def proximo_dia_de_lembrete(hoje: date) -> date:
    """Próxima segunda ou dia 25, a contar de hoje (inclusive)."""
    dia = hoje
    while not dia_de_lembrete(dia):
        dia = date.fromordinal(dia.toordinal() + 1)
    return dia


def devendo_checkin(db: Session, point_id: int, hoje: date) -> list[SaldoAlunoOut]:
    """Saldos negativos do mês corrente no Point, só de quem tem matrícula
    ativa paga por benefício (quem saiu não recebe lembrete)."""
    aluno_ids = {
        aluno_id
        for (aluno_id,) in db.query(Matricula.aluno_id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == point_id,
            Matricula.status == MatriculaStatus.ATIVA,
            Matricula.fonte_pagamento.in_(list(PLATAFORMA_DO_MEIO)),
        )
        .distinct()
        .all()
    }
    inicio = hoje.replace(day=1)
    fim = hoje.replace(day=calendar.monthrange(hoje.year, hoje.month)[1])
    saldos = saldos_de_checkins(db, aluno_ids=aluno_ids, inicio=inicio, fim=fim, point_ids={point_id})
    return [s for s in saldos if s.saldo < 0]


def enviar_lembrete(db: Session, saldo: SaldoAlunoOut) -> None:
    """WhatsApp + e-mail; cada canal é fail-soft (sem credencial só loga)."""
    from app.services.email import enviar_lembrete_checkin_email
    from app.services.whatsapp import enviar_lembrete_checkin_whatsapp

    aluno = db.get(Aluno, saldo.aluno_id)
    if aluno is None:
        return
    plataforma = ROTULO_PLATAFORMA.get(saldo.plataforma, saldo.plataforma)
    enviar_lembrete_checkin_whatsapp(
        celular=aluno.contato,
        nome=aluno.nome,
        point_nome=saldo.point_nome,
        faltam=-saldo.saldo,
        plataforma=plataforma,
        point_id=saldo.point_id,
    )
    enviar_lembrete_checkin_email(
        nome=aluno.nome,
        email=aluno.email,
        point_nome=saldo.point_nome,
        faltam=-saldo.saldo,
        plataforma=plataforma,
        point_id=saldo.point_id,
    )


def rodar_lembretes(db: Session, hoje: date | None = None) -> int:
    hoje = hoje or date.today()
    if not dia_de_lembrete(hoje):
        return 0
    total = 0
    for point in db.query(Point).filter(Point.lembrete_checkin.is_(True)).all():
        for saldo in devendo_checkin(db, point.id, hoje):
            enviar_lembrete(db, saldo)
            total += 1
    return total
