from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import (
    CreditoMotivo,
    CreditoStatus,
    MatriculaStatus,
    MatriculaTipo,
    PeriodoDia,
    Role,
    VinculoStatus,
)
from app.models.aula import Aula
from app.models.matricula import Matricula
from app.models.modalidade import Modalidade
from app.models.point import DIAS_UTEIS
from app.models.quadra import Quadra
from app.models.turma import Turma
from app.models.turma_dia_semana import TurmaDiaSemana
from app.models.turma_excecao import TurmaExcecao
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.turma import (
    RemocaoTurmaOut,
    TurmaCreate,
    TurmaOut,
    TurmaProlongamento,
    TurmaRemocao,
)
from app.services.aulas import DIAS_SEMANA

router = APIRouter(tags=["turmas"])


@router.post("/turmas", response_model=list[TurmaOut], status_code=201)
def criar_turmas(
    payload: TurmaCreate,
    db: Annotated[Session, Depends(get_db)],
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> list[Turma]:
    """Cria 1 turma por horário selecionado, cada uma cobrindo todos os dias
    marcados — dois dias e dois horários viram 2 turmas, não 4 (pedido do
    usuário, 2026-08-20: turma é o grupo/horário recorrente inteiro)."""
    vinculo = db.get(Vinculo, payload.vinculo_id)
    if vinculo is None or vinculo.professor_id != professor.professor_id:
        raise HTTPException(404, "Vínculo não encontrado")
    if vinculo.status != VinculoStatus.ATIVO:
        raise HTTPException(422, "O vínculo ainda não foi aprovado pelo Point")

    modalidade = db.get(Modalidade, payload.modalidade_id)
    if modalidade is None or modalidade.point_id != vinculo.point_id:
        raise HTTPException(404, "Modalidade não encontrada neste Point")

    quadra = db.get(Quadra, payload.quadra_id)
    if quadra is None or quadra.point_id != vinculo.point_id:
        raise HTTPException(404, "Quadra não encontrada neste Point")
    if modalidade not in quadra.modalidades:
        raise HTTPException(422, "Essa quadra não está cadastrada para essa modalidade")

    if not payload.dias_semana or not payload.horarios:
        raise HTTPException(422, "Escolha pelo menos um dia e um horário")
    if payload.periodo_fim is not None and payload.periodo_inicio > payload.periodo_fim:
        raise HTTPException(422, "O início do período precisa ser antes do fim")

    # Point define em que dias/horários funciona, separado por dias úteis x
    # fim de semana (pedido do usuário, 2026-08-21 — sábado costuma ter só
    # parte da manhã, bem diferente do horário de semana). Checa cada
    # combinação dia×horário contra o grupo certo, já que um mesmo lote
    # pode misturar dia útil com fim de semana no mesmo horário selecionado.
    point = vinculo.point
    violacoes: list[str] = []
    for dia in payload.dias_semana:
        if dia in DIAS_UTEIS:
            dias_ok = point.dias_semana_funcionamento
            horarios_ok = point.horarios_semana_funcionamento
        else:
            dias_ok = point.dias_fds_funcionamento
            horarios_ok = point.horarios_fds_funcionamento
        if dia not in dias_ok:
            violacoes.append(f"{dia} (Point fechado nesse dia)")
            continue
        fora = sorted(set(payload.horarios) - set(horarios_ok))
        if fora:
            violacoes.append(f"{dia} às {', '.join(fora)}")
    if violacoes:
        raise HTTPException(
            422, f"Fora do horário de funcionamento do Point: {'; '.join(violacoes)}"
        )

    # Agenda validada globalmente (seção 3.1) — o professor é uma entidade
    # única e global, então o conflito é checado em TODOS os vínculos dele,
    # não só no Point deste vínculo. Duas turmas só colidem de verdade se o
    # dia/horário bate E os períodos se sobrepõem — periodo_fim nulo (turma
    # recorrente, sem data de término, pedido do usuário 2026-08-20) conta
    # como "nunca termina", não pode sumir da checagem por causa do NULL.
    filtro_periodo = [
        or_(Turma.periodo_fim.is_(None), Turma.periodo_fim >= payload.periodo_inicio),
    ]
    if payload.periodo_fim is not None:
        filtro_periodo.append(Turma.periodo_inicio <= payload.periodo_fim)

    conflitos = (
        db.query(Turma, TurmaDiaSemana.dia_semana)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .join(TurmaDiaSemana, TurmaDiaSemana.turma_id == Turma.id)
        .filter(
            Vinculo.professor_id == professor.professor_id,
            TurmaDiaSemana.dia_semana.in_(payload.dias_semana),
            Turma.horario.in_(payload.horarios),
            *filtro_periodo,
        )
        .all()
    )
    if conflitos:
        ocupados = ", ".join(sorted({f"{dia} {t.horario}" for t, dia in conflitos}))
        raise HTTPException(409, f"Você já tem turma nesse horário: {ocupados}")

    duracao = payload.duracao_minutos or modalidade.duracao_padrao_minutos

    turmas = [
        Turma(
            vinculo_id=vinculo.id,
            modalidade_id=modalidade.id,
            quadra_id=quadra.id,
            capacidade=payload.capacidade,
            horario=horario,
            duracao_minutos=duracao,
            recorrencia=payload.recorrencia,
            periodo_inicio=payload.periodo_inicio,
            periodo_fim=payload.periodo_fim,
            dias_semana_rel=[TurmaDiaSemana(dia_semana=dia) for dia in payload.dias_semana],
        )
        for horario in payload.horarios
    ]
    db.add_all(turmas)
    db.commit()
    for turma in turmas:
        db.refresh(turma)
    return turmas


@router.post("/turmas/{turma_id}/remocoes", response_model=RemocaoTurmaOut)
def remover_turma(
    turma_id: int,
    payload: TurmaRemocao,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> RemocaoTurmaOut:
    """Remover uma turma recorrente, do jeito que se edita um evento
    recorrente num calendário (pedido do usuário, 2026-08-20):

    - 'unica_data': a série continua normal nas outras semanas; só essa data
      vira uma TurmaExcecao (o gerador de aulas passa a pular ela) e qualquer
      Aula já gerada pra essa data é removida.
    - 'a_partir_desta_data': encerra a série dali pra frente (periodo_fim =
      véspera da data escolhida). Se a turma nunca teve nenhuma matrícula, a
      linha é apagada de vez em vez de sobrar um período fechado sem uso;
      se já teve, só encurtamos o período — apagar quebraria a integridade
      referencial de pagamentos/créditos/aulas já ligados a ela.

    Admin do Point também pode (pedido do usuário, 2026-08-26: "cria o
    Agenda também [pro admin], igual professor") — o admin cobre o Point
    inteiro, não só as próprias turmas.

    gerar_credito (pedido do usuário, 2026-08-28) consolida aqui o que
    antes era um formulário solto de "cancelar aula por força maior"
    (turma + data escolhidas manualmente, sem nenhuma ligação com a
    ocorrência sendo removida na agenda) — agora é só um check nessa
    mesma remoção: gera crédito de reposição pra quem tinha aula
    justamente na data removida (mesma regra de matricula_tem_aula_em:
    mensal só entra se esse dia da semana for dela; avulsa só se for a
    própria data)."""
    turma = db.get(Turma, turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")
    pode = (user.tem_role(Role.PROFESSOR) and turma.vinculo.professor_id == user.professor_id) or (
        user.tem_role(Role.ADMIN_POINT) and turma.vinculo.point_id == user.point_id
    )
    if not pode:
        raise HTTPException(404, "Turma não encontrada")

    if payload.data < date.today():
        raise HTTPException(422, "Não dá pra remover uma data que já passou")
    if DIAS_SEMANA[payload.data.weekday()] not in turma.dias_semana:
        dias = ", ".join(f"{d}s" for d in turma.dias_semana)
        raise HTTPException(422, f"Essa turma acontece às {dias}, não nessa data")

    creditos_gerados = 0
    if payload.gerar_credito:
        dia_semana_removido = DIAS_SEMANA[payload.data.weekday()]
        matriculas_afetadas = [
            m
            for m in db.query(Matricula)
            .filter(Matricula.turma_id == turma_id, Matricula.status == MatriculaStatus.ATIVA)
            .all()
            if (
                dia_semana_removido in m.dias_semana
                if m.tipo == MatriculaTipo.MENSAL
                else m.data_avulsa == payload.data
            )
        ]
        if matriculas_afetadas:
            prazo_dias = turma.vinculo.point.prazo_credito_dias
            creditos = [
                CreditoReposicao(
                    matricula_id=m.id,
                    motivo=CreditoMotivo.FORCA_MAIOR,
                    data_aula=payload.data,
                    data_expiracao=date.today() + timedelta(days=prazo_dias),
                    status=CreditoStatus.DISPONIVEL,
                )
                for m in matriculas_afetadas
            ]
            db.add_all(creditos)
            creditos_gerados = len(creditos)

    if payload.escopo == "unica_data":
        if not (payload.motivo and payload.motivo.strip()):
            raise HTTPException(422, "Informe o motivo do cancelamento")
        if payload.data < turma.periodo_inicio or (
            turma.periodo_fim is not None and payload.data > turma.periodo_fim
        ):
            raise HTTPException(422, "Essa data está fora do período da turma")
        ja_existe = (
            db.query(TurmaExcecao)
            .filter(TurmaExcecao.turma_id == turma.id, TurmaExcecao.data == payload.data)
            .first()
        )
        if ja_existe:
            raise HTTPException(409, "Essa data já tinha sido removida")

        db.add(TurmaExcecao(turma_id=turma.id, data=payload.data, motivo=payload.motivo.strip()))
        aulas_removidas = (
            db.query(Aula)
            .filter(
                Aula.matricula_id.in_(
                    db.query(Matricula.id).filter(Matricula.turma_id == turma.id)
                ),
                Aula.data == payload.data,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return RemocaoTurmaOut(
            turma_removida=False,
            aulas_removidas=aulas_removidas,
            novo_periodo_fim=turma.periodo_fim,
            creditos_gerados=creditos_gerados,
        )

    # escopo == "a_partir_desta_data"
    novo_fim = payload.data - timedelta(days=1)
    aulas_removidas = (
        db.query(Aula)
        .filter(
            Aula.matricula_id.in_(db.query(Matricula.id).filter(Matricula.turma_id == turma.id)),
            Aula.data >= payload.data,
        )
        .delete(synchronize_session=False)
    )

    tem_historico = (
        db.query(Matricula.id).filter(Matricula.turma_id == turma.id).first() is not None
    )
    if not tem_historico:
        db.delete(turma)
        db.commit()
        return RemocaoTurmaOut(
            turma_removida=True,
            aulas_removidas=aulas_removidas,
            novo_periodo_fim=None,
            creditos_gerados=creditos_gerados,
        )

    turma.periodo_fim = novo_fim
    db.commit()
    return RemocaoTurmaOut(
        turma_removida=False,
        aulas_removidas=aulas_removidas,
        novo_periodo_fim=novo_fim,
        creditos_gerados=creditos_gerados,
    )


@router.patch("/turmas/{turma_id}/periodo", response_model=TurmaOut)
def prolongar_turma(
    turma_id: int,
    payload: TurmaProlongamento,
    db: Annotated[Session, Depends(get_db)],
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> Turma:
    """Estender o período de uma turma (pedido do usuário, 2026-08-20) —
    edição direta, sem criar turma nova nem mexer em matrícula/histórico,
    porque só alarga o futuro: nada que já aconteceu muda de sentido.
    Só serve pra alargar; encurtar é o 'remover a partir desta data'."""
    turma = db.get(Turma, turma_id)
    if turma is None or turma.vinculo.professor_id != professor.professor_id:
        raise HTTPException(404, "Turma não encontrada")

    if turma.periodo_fim is None:
        raise HTTPException(422, "Essa turma já é recorrente, sem data de término")
    if payload.periodo_fim is not None and payload.periodo_fim <= turma.periodo_fim:
        raise HTTPException(
            422,
            "A nova data precisa ser depois da atual — pra encurtar, use a remoção de turma",
        )

    # Só precisa checar conflito na janela nova (a antiga já era livre) —
    # mesma regra global de agenda da criação (seção 3.1).
    inicio_janela = turma.periodo_fim + timedelta(days=1)
    filtro_periodo = [or_(Turma.periodo_fim.is_(None), Turma.periodo_fim >= inicio_janela)]
    if payload.periodo_fim is not None:
        filtro_periodo.append(Turma.periodo_inicio <= payload.periodo_fim)

    conflitos = (
        db.query(Turma, TurmaDiaSemana.dia_semana)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .join(TurmaDiaSemana, TurmaDiaSemana.turma_id == Turma.id)
        .filter(
            Vinculo.professor_id == professor.professor_id,
            Turma.id != turma.id,
            TurmaDiaSemana.dia_semana.in_(turma.dias_semana),
            Turma.horario == turma.horario,
            *filtro_periodo,
        )
        .all()
    )
    if conflitos:
        ocupados = ", ".join(sorted({f"{dia} {t.horario}" for t, dia in conflitos}))
        raise HTTPException(409, f"Você já tem turma nesse horário: {ocupados}")

    turma.periodo_fim = payload.periodo_fim
    db.commit()
    db.refresh(turma)
    return turma


@router.get("/professores/me/turmas", response_model=list[TurmaOut])
def minhas_turmas(
    db: Annotated[Session, Depends(get_db)],
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> list[Turma]:
    """Visão consolidada — soma as turmas de todos os vínculos ativos do professor,
    de todos os Points onde ele atua (seção 3.1)."""
    return (
        db.query(Turma)
        .join(Vinculo)
        .filter(Vinculo.professor_id == professor.professor_id)
        .all()
    )


PERIODO_DIA_HORAS = {
    PeriodoDia.MANHA: range(5, 12),
    PeriodoDia.TARDE: range(12, 18),
    PeriodoDia.NOITE: range(18, 24),
}


@router.get("/turmas", response_model=list[TurmaOut])
def buscar_turmas(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    modalidade: str | None = None,
    modalidade_id: int | None = None,
    point_id: int | None = None,
    professor_id: int | None = None,
    periodo_dia: PeriodoDia | None = None,
) -> list[Turma]:
    """Busca do aluno por modalidade/local (seção 4.2) — qualquer usuário
    autenticado pode ver, em qualquer Point/professor. Só turmas de vínculos
    ativos aparecem; a checagem de vaga disponível fica pra uma etapa futura
    (controle de capacidade da Turma, ainda fora deste scaffold). point_id
    também serve pro admin do Point listar só as turmas do seu Point (ex.:
    pra escolher qual cancelar por força maior, ou quais oferecer na
    ativação de uma assinatura — daí modalidade_id e periodo_dia). professor_id
    é o que a tela de reagendar crédito usa (pedido do usuário, 2026-08-25:
    "só pode reagendar com o professor que já dá aula pra ele")."""
    query = (
        db.query(Turma)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.status == VinculoStatus.ATIVO,
            or_(Turma.periodo_fim.is_(None), Turma.periodo_fim >= date.today()),
        )
    )
    if modalidade:
        query = query.join(Modalidade, Turma.modalidade_id == Modalidade.id).filter(
            Modalidade.nome.ilike(f"%{modalidade}%")
        )
    if modalidade_id:
        query = query.filter(Turma.modalidade_id == modalidade_id)
    if point_id:
        query = query.filter(Vinculo.point_id == point_id)
    if professor_id:
        query = query.filter(Vinculo.professor_id == professor_id)
    turmas = query.all()
    if periodo_dia:
        horas_validas = PERIODO_DIA_HORAS[periodo_dia]
        turmas = [t for t in turmas if int(t.horario.split(":")[0]) in horas_validas]
    return turmas


# O antigo POST /turmas/{turma_id}/cancelamentos ("Cancelar aula por força
# maior", formulário solto na tela do Professor) foi removido (pedido do
# usuário, 2026-08-28: "esse botão sai da tela do professor e fica tb na
# agenda") — a mesma coisa (gerar crédito de reposição por causa de uma
# aula cancelada) agora é só o check "gerar crédito" dentro da remoção de
# ocorrência pela Agenda (remover_turma acima), que já sabe a turma e a
# data certas, sem precisar escolher os dois de novo à mão.


@router.get("/vinculos/{vinculo_id}/turmas", response_model=list[TurmaOut])
def turmas_do_vinculo(
    vinculo_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Turma]:
    vinculo = db.get(Vinculo, vinculo_id)
    if vinculo is None or vinculo.point_id != admin.point_id:
        raise HTTPException(404, "Vínculo não encontrado")
    return db.query(Turma).filter(Turma.vinculo_id == vinculo_id).all()
