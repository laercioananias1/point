"""Saldo de check-ins por aluno (check-ins de Wellhub/TotalPass x aulas
com presença confirmada), saído de routers/wellhub.py pra ser usado também
pelo lembrete automático de check-in e pelo aviso na chamada (pedido do
usuário, 2026-10-02)."""

from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.checkin import Checkin
from app.models.enums import CheckinStatus, MatriculaStatus, PagamentoMeio
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.turma import Turma
from app.models.vinculo import Vinculo
from app.models.wellhub_checkin import WellhubCheckin
from app.schemas.wellhub import SaldoAlunoOut

PLATAFORMA_DO_MEIO = {PagamentoMeio.WELLHUB: "wellhub", PagamentoMeio.TOTALPASS: "totalpass"}


def saldos_de_checkins(
    db: Session, *, aluno_ids: set[int], inicio: date, fim: date, point_ids: set[int] | None = None
) -> list[SaldoAlunoOut]:
    """Mesma conta do acerto do mês do admin (só quantidade, sem casar data
    de check-in com data de aula), por aluno + Point + plataforma. Inclui
    matrícula ativa paga por benefício mesmo sem movimento no mês, pra o
    saldo aparecer zerado desde o dia 1. `point_ids` recorta os Points
    (professor só vê os Points onde dá aula)."""
    if not aluno_ids:
        return []
    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fim_dt = datetime.combine(fim, datetime.max.time())
    beneficio = list(PLATAFORMA_DO_MEIO)

    q_checkins = db.query(
        WellhubCheckin.aluno_id, WellhubCheckin.point_id, WellhubCheckin.plataforma, func.count(WellhubCheckin.id)
    ).filter(
        WellhubCheckin.aluno_id.in_(aluno_ids),
        WellhubCheckin.data >= inicio,
        WellhubCheckin.data <= fim,
    )
    q_aulas = (
        db.query(Matricula.aluno_id, Vinculo.point_id, Matricula.fonte_pagamento, func.count(Checkin.id))
        .join(Checkin, Checkin.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Matricula.aluno_id.in_(aluno_ids),
            Matricula.fonte_pagamento.in_(beneficio),
            Checkin.status == CheckinStatus.CONFIRMADO,
            Checkin.data_hora >= inicio_dt,
            Checkin.data_hora <= fim_dt,
        )
    )
    q_ativas = (
        db.query(Matricula.aluno_id, Vinculo.point_id, Matricula.fonte_pagamento)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Matricula.aluno_id.in_(aluno_ids),
            Matricula.status == MatriculaStatus.ATIVA,
            Matricula.fonte_pagamento.in_(beneficio),
        )
    )
    if point_ids is not None:
        q_checkins = q_checkins.filter(WellhubCheckin.point_id.in_(point_ids))
        q_aulas = q_aulas.filter(Vinculo.point_id.in_(point_ids))
        q_ativas = q_ativas.filter(Vinculo.point_id.in_(point_ids))

    checkins = {
        (aluno_id, point_id, plataforma): qtd
        for aluno_id, point_id, plataforma, qtd in q_checkins.group_by(
            WellhubCheckin.aluno_id, WellhubCheckin.point_id, WellhubCheckin.plataforma
        ).all()
    }
    aulas = {
        (aluno_id, point_id, PLATAFORMA_DO_MEIO[fonte]): qtd
        for aluno_id, point_id, fonte, qtd in q_aulas.group_by(
            Matricula.aluno_id, Vinculo.point_id, Matricula.fonte_pagamento
        ).all()
    }
    ativas = {
        (aluno_id, point_id, PLATAFORMA_DO_MEIO[fonte]) for aluno_id, point_id, fonte in q_ativas.distinct().all()
    }

    chaves = set(checkins) | set(aulas) | ativas
    if not chaves:
        return []
    nomes = dict(db.query(Point.id, Point.nome).filter(Point.id.in_({p for _, p, _ in chaves})).all())
    return sorted(
        (
            SaldoAlunoOut(
                aluno_id=aluno_id,
                point_id=point_id,
                point_nome=nomes.get(point_id, ""),
                plataforma=plataforma,
                checkins=checkins.get(chave, 0),
                aulas=aulas.get(chave, 0),
                saldo=checkins.get(chave, 0) - aulas.get(chave, 0),
            )
            for chave in chaves
            for aluno_id, point_id, plataforma in [chave]
        ),
        key=lambda s: (s.point_nome, s.plataforma, s.aluno_id),
    )
