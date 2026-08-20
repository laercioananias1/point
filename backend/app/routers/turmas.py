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
    PeriodoDia,
    Role,
    VinculoStatus,
)
from app.models.aula import Aula
from app.models.matricula import Matricula
from app.models.modalidade import Modalidade
from app.models.quadra import Quadra
from app.models.turma import Turma
from app.models.turma_excecao import TurmaExcecao
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.credito import CancelamentoAula, CreditoOut
from app.schemas.turma import RemocaoTurmaOut, TurmaCreate, TurmaOut, TurmaRemocao
from app.services.aulas import DIAS_SEMANA

router = APIRouter(tags=["turmas"])


@router.post("/turmas", response_model=list[TurmaOut], status_code=201)
def criar_turmas(
    payload: TurmaCreate,
    db: Annotated[Session, Depends(get_db)],
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
) -> list[Turma]:
    """Cria 1 turma por combinação dia × horário — dois dias e dois horários
    viram 4 turmas numa chamada só (pedido do usuário, 2026-08-19)."""
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
        db.query(Turma)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.professor_id == professor.professor_id,
            Turma.dia_semana.in_(payload.dias_semana),
            Turma.horario.in_(payload.horarios),
            *filtro_periodo,
        )
        .all()
    )
    if conflitos:
        ocupados = ", ".join(sorted({f"{t.dia_semana} {t.horario}" for t in conflitos}))
        raise HTTPException(409, f"Você já tem turma nesse horário: {ocupados}")

    duracao = payload.duracao_minutos or modalidade.duracao_padrao_minutos

    turmas = [
        Turma(
            vinculo_id=vinculo.id,
            modalidade_id=modalidade.id,
            quadra_id=quadra.id,
            capacidade=payload.capacidade,
            dia_semana=dia,
            horario=horario,
            duracao_minutos=duracao,
            recorrencia=payload.recorrencia,
            periodo_inicio=payload.periodo_inicio,
            periodo_fim=payload.periodo_fim,
        )
        for dia in payload.dias_semana
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
    professor: Annotated[User, Depends(require_role(Role.PROFESSOR))],
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
      referencial de pagamentos/créditos/aulas já ligados a ela."""
    turma = db.get(Turma, turma_id)
    if turma is None or turma.vinculo.professor_id != professor.professor_id:
        raise HTTPException(404, "Turma não encontrada")

    if payload.data < date.today():
        raise HTTPException(422, "Não dá pra remover uma data que já passou")
    if DIAS_SEMANA[payload.data.weekday()] != turma.dia_semana:
        raise HTTPException(422, f"Essa turma acontece às {turma.dia_semana}s, não nessa data")

    if payload.escopo == "unica_data":
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

        db.add(TurmaExcecao(turma_id=turma.id, data=payload.data))
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
            turma_removida=False, aulas_removidas=aulas_removidas, novo_periodo_fim=turma.periodo_fim
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
        return RemocaoTurmaOut(turma_removida=True, aulas_removidas=aulas_removidas, novo_periodo_fim=None)

    turma.periodo_fim = novo_fim
    db.commit()
    return RemocaoTurmaOut(
        turma_removida=False, aulas_removidas=aulas_removidas, novo_periodo_fim=novo_fim
    )


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
    periodo_dia: PeriodoDia | None = None,
) -> list[Turma]:
    """Busca do aluno por modalidade/local (seção 4.2) — qualquer usuário
    autenticado pode ver, em qualquer Point/professor. Só turmas de vínculos
    ativos aparecem; a checagem de vaga disponível fica pra uma etapa futura
    (controle de capacidade da Turma, ainda fora deste scaffold). point_id
    também serve pro admin do Point listar só as turmas do seu Point (ex.:
    pra escolher qual cancelar por força maior, ou quais oferecer na
    ativação de uma assinatura — daí modalidade_id e periodo_dia)."""
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
    turmas = query.all()
    if periodo_dia:
        horas_validas = PERIODO_DIA_HORAS[periodo_dia]
        turmas = [t for t in turmas if int(t.horario.split(":")[0]) in horas_validas]
    return turmas


@router.post("/turmas/{turma_id}/cancelamentos", response_model=list[CreditoOut])
def cancelar_aula_por_forca_maior(
    turma_id: int,
    payload: CancelamentoAula,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[CreditoReposicao]:
    """Chuva, quadra indisponível etc. (seção 4.4) — gera crédito de reposição
    pra todo aluno com matrícula ativa na turma. Não existe uma entidade
    'Aula' (ocorrência específica); data_aula em CancelamentoAula só marca
    qual dia motivou o cancelamento, pro histórico."""
    turma = db.get(Turma, turma_id)
    if turma is None or turma.vinculo.point_id != admin.point_id:
        raise HTTPException(404, "Turma não encontrada")

    matriculas_ativas = (
        db.query(Matricula)
        .filter(Matricula.turma_id == turma_id, Matricula.status == MatriculaStatus.ATIVA)
        .all()
    )

    prazo_dias = turma.vinculo.point.prazo_credito_dias
    creditos = [
        CreditoReposicao(
            matricula_id=m.id,
            motivo=CreditoMotivo.FORCA_MAIOR,
            data_aula=payload.data_aula,
            data_expiracao=date.today() + timedelta(days=prazo_dias),
            status=CreditoStatus.DISPONIVEL,
        )
        for m in matriculas_ativas
    ]
    db.add_all(creditos)
    db.commit()
    for c in creditos:
        db.refresh(c)
    return creditos


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
