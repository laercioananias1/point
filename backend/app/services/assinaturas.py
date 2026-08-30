from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.assinatura import Assinatura
from app.models.enums import MatriculaStatus, MatriculaTipo, PagamentoMeio, PeriodoDia, VinculoStatus
from app.models.matricula import Matricula
from app.models.matricula_dia_semana import MatriculaDiaSemana
from app.models.plano import Plano
from app.models.turma import Turma
from app.services.aulas import gerar_aulas_do_mes

"""Lógica de validação/criação de Assinatura compartilhada entre o cadastro
de Convite (valida na hora de convidar) e o aceite do Convite (revalida e
efetiva — pedido do usuário, 2026-08-20: turma/plano podem ter mudado no
meio-tempo entre o convite ser mandado e ser aceito, então não dá pra só
confiar no que foi validado na criação).

Escolha = (turma_id, dias escolhidos NESSA turma) — pedido do usuário,
2026-08-21: a Turma é a agenda inteira do professor (ex.: seg a sex, 8h);
cada aluno usa só um SUBCONJUNTO dela. Antes a soma tinha que bater com
TODOS os dias de cada turma escolhida — agora o admin escolhe, dentro de
cada turma, quais dias esse aluno específico frequenta."""


def validar_turmas_para_plano(
    db: Session,
    *,
    point_id: int,
    modalidade_id: int,
    plano: Plano,
    escolhas: list[tuple[int, list[str]]],
) -> list[tuple[Turma, list[str]]]:
    if not escolhas:
        raise HTTPException(422, "Escolha ao menos uma turma e os dias")

    turma_ids = [turma_id for turma_id, _ in escolhas]
    if len(turma_ids) != len(set(turma_ids)):
        raise HTTPException(422, "Turma repetida na escolha")

    turmas = db.query(Turma).filter(Turma.id.in_(turma_ids)).all()
    turmas_por_id = {turma.id: turma for turma in turmas}
    if len(turmas) != len(turma_ids):
        raise HTTPException(404, "Alguma turma não foi encontrada")

    resultado: list[tuple[Turma, list[str]]] = []
    total_dias = 0
    for turma_id, dias in escolhas:
        turma = turmas_por_id[turma_id]
        if turma.vinculo.point_id != point_id:
            raise HTTPException(404, "Alguma turma não pertence a este Point")
        if turma.modalidade_id != modalidade_id:
            raise HTTPException(422, "Alguma turma escolhida não é da modalidade pedida")
        if turma.vinculo.status != VinculoStatus.ATIVO:
            raise HTTPException(422, "Alguma turma escolhida tem vínculo inativo")

        dias_unicos = sorted(set(dias))
        if not dias_unicos:
            raise HTTPException(422, "Escolha pelo menos um dia em cada turma selecionada")
        fora = set(dias_unicos) - set(turma.dias_semana)
        if fora:
            raise HTTPException(
                422, f"Essa turma não acontece em: {', '.join(sorted(fora))}"
            )

        resultado.append((turma, dias_unicos))
        total_dias += len(dias_unicos)

    if total_dias != plano.frequencia_semanal:
        raise HTTPException(
            422,
            f"O plano de {plano.frequencia_semanal}x por semana precisa de exatamente "
            f"{plano.frequencia_semanal} dia(s) escolhidos no total — foram {total_dias}",
        )

    return resultado


def criar_assinatura_ativa(
    db: Session,
    *,
    aluno_id: int,
    point_id: int,
    modalidade_id: int,
    periodo_dia_desejado: PeriodoDia,
    fonte_pagamento: PagamentoMeio,
    plano: Plano,
    escolhas: list[tuple[Turma, list[str]]],
    data_inicio: date,
) -> Assinatura:
    assinatura = Assinatura(
        aluno_id=aluno_id,
        point_id=point_id,
        modalidade_id=modalidade_id,
        frequencia_semanal_desejada=plano.frequencia_semanal,
        periodo_dia_desejado=periodo_dia_desejado,
        fonte_pagamento=fonte_pagamento,
        status=MatriculaStatus.ATIVA,
        plano_id=plano.id,
        data_inicio=data_inicio,
        turmas=[turma for turma, _ in escolhas],
    )
    db.add(assinatura)
    db.flush()  # garante assinatura.id antes de criar as matrículas

    for turma, dias in escolhas:
        matricula = Matricula(
            aluno_id=aluno_id,
            turma_id=turma.id,
            tipo=MatriculaTipo.MENSAL,
            status=MatriculaStatus.ATIVA,
            fonte_pagamento=fonte_pagamento,
            assinatura_id=assinatura.id,
        )
        db.add(matricula)
        db.flush()  # garante matricula.id antes de gerar as aulas
        matricula.dias_semana_rel = [MatriculaDiaSemana(dia_semana=dia) for dia in dias]
        db.flush()
        gerar_aulas_do_mes(db, matricula)

    return assinatura
