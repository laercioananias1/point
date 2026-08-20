from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.assinatura import Assinatura
from app.models.enums import MatriculaStatus, MatriculaTipo, Role, VinculoStatus
from app.models.matricula import Matricula
from app.models.modalidade import Modalidade
from app.models.plano import Plano
from app.models.point import Point
from app.models.turma import Turma
from app.models.user import User
from app.schemas.assinatura import AssinaturaAtivar, AssinaturaCreate, AssinaturaOut
from app.services.aulas import gerar_aulas_do_mes

router = APIRouter(prefix="/assinaturas", tags=["assinaturas"])


@router.post("", response_model=AssinaturaOut, status_code=201)
def declarar_interesse(
    payload: AssinaturaCreate,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Assinatura:
    """O aluno só declara o que quer — modalidade, quantas vezes por semana,
    período do dia — sem escolher turma nenhuma (pedido do usuário,
    2026-08-19). Quem monta a grade de turmas é o admin, na ativação."""
    if db.get(Point, payload.point_id) is None:
        raise HTTPException(404, "Point não encontrado")

    modalidade = db.get(Modalidade, payload.modalidade_id)
    if modalidade is None or modalidade.point_id != payload.point_id:
        raise HTTPException(404, "Modalidade não encontrada neste Point")

    if not 1 <= payload.frequencia_semanal_desejada <= 6:
        raise HTTPException(422, "Frequência semanal precisa estar entre 1 e 6")

    assinatura = Assinatura(
        aluno_id=aluno.aluno_id,
        status=MatriculaStatus.EM_ANALISE,
        **payload.model_dump(),
    )
    db.add(assinatura)
    db.commit()
    db.refresh(assinatura)
    return assinatura


@router.get("", response_model=list[AssinaturaOut])
def listar_assinaturas_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Assinatura]:
    return db.query(Assinatura).filter(Assinatura.point_id == admin.point_id).all()


@router.patch("/{assinatura_id}/ativar", response_model=AssinaturaOut)
def ativar_assinatura(
    assinatura_id: int,
    payload: AssinaturaAtivar,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Assinatura:
    """Aqui é onde 'turma e dias' entram, do jeito que o usuário pediu: o
    admin escolhe o Plano (define a frequência esperada), escolhe exatamente
    essa quantidade de Turmas e informa a data de início. O sistema then:
    cria 1 Matrícula por Turma escolhida e já gera as Aulas do mês corrente
    — os meses seguintes vêm do endpoint de geração mensal."""
    assinatura = db.get(Assinatura, assinatura_id)
    if assinatura is None or assinatura.point_id != admin.point_id:
        raise HTTPException(404, "Assinatura não encontrada")
    if assinatura.status != MatriculaStatus.EM_ANALISE:
        raise HTTPException(422, "Essa assinatura já foi decidida")

    plano = db.get(Plano, payload.plano_id)
    if plano is None or plano.point_id != admin.point_id:
        raise HTTPException(404, "Plano não encontrado neste Point")

    turma_ids_unicos = set(payload.turma_ids)
    if len(turma_ids_unicos) != plano.frequencia_semanal:
        raise HTTPException(
            422,
            f"O plano de {plano.frequencia_semanal}x por semana precisa de exatamente "
            f"{plano.frequencia_semanal} turma(s) diferentes — {len(turma_ids_unicos)} foram escolhidas",
        )

    turmas = db.query(Turma).filter(Turma.id.in_(turma_ids_unicos)).all()
    if len(turmas) != len(turma_ids_unicos):
        raise HTTPException(404, "Alguma turma não foi encontrada")
    for turma in turmas:
        if turma.vinculo.point_id != admin.point_id:
            raise HTTPException(404, "Alguma turma não pertence a este Point")
        if turma.modalidade_id != assinatura.modalidade_id:
            raise HTTPException(422, "Alguma turma escolhida não é da modalidade pedida")
        if turma.vinculo.status != VinculoStatus.ATIVO:
            raise HTTPException(422, "Alguma turma escolhida tem vínculo inativo")

    assinatura.plano_id = plano.id
    assinatura.data_inicio = payload.data_inicio
    assinatura.status = MatriculaStatus.ATIVA
    assinatura.turmas = turmas

    for turma in turmas:
        matricula = Matricula(
            aluno_id=assinatura.aluno_id,
            turma_id=turma.id,
            tipo=MatriculaTipo.MENSAL,
            status=MatriculaStatus.ATIVA,
            fonte_pagamento=assinatura.fonte_pagamento,
            assinatura_id=assinatura.id,
        )
        db.add(matricula)
        db.flush()  # garante matricula.id antes de gerar as aulas
        gerar_aulas_do_mes(db, matricula)

    db.commit()
    db.refresh(assinatura)
    return assinatura


@router.patch("/{assinatura_id}/recusar", response_model=AssinaturaOut)
def recusar_assinatura(
    assinatura_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Assinatura:
    assinatura = db.get(Assinatura, assinatura_id)
    if assinatura is None or assinatura.point_id != admin.point_id:
        raise HTTPException(404, "Assinatura não encontrada")
    if assinatura.status != MatriculaStatus.EM_ANALISE:
        raise HTTPException(422, "Essa assinatura já foi decidida")

    assinatura.status = MatriculaStatus.RECUSADA
    db.commit()
    db.refresh(assinatura)
    return assinatura


@router.patch("/{assinatura_id}/cancelar", response_model=AssinaturaOut)
def cancelar_assinatura(
    assinatura_id: int,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Assinatura:
    """Desistência (pedido do usuário, 2026-08-19) — o aluno não quer mais
    continuar o plano. Cancela a assinatura e todas as matrículas que vieram
    dela, o que já é suficiente pra geração mensal de aulas parar de gerar
    (ela só olha matrícula ativa)."""
    assinatura = db.get(Assinatura, assinatura_id)
    if assinatura is None or assinatura.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Assinatura não encontrada")
    if assinatura.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível cancelar uma assinatura ativa")

    assinatura.status = MatriculaStatus.CANCELADA
    for matricula in assinatura.matriculas:
        if matricula.status == MatriculaStatus.ATIVA:
            matricula.status = MatriculaStatus.CANCELADA

    db.commit()
    db.refresh(assinatura)
    return assinatura


@router.post("/points/{point_id}/gerar-aulas-do-mes")
def gerar_aulas_do_mes_do_point(
    point_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT, Role.SUPER_ADMIN))],
) -> dict[str, int]:
    """Roda a geração mensal pra todas as assinaturas ativas do Point — na
    prática dispararia sozinho no início de cada mês (job agendado, seção 7);
    aqui é o endpoint que esse job chamaria, e também dá pra disparar na mão
    pra conferir. Só gera pra matrícula/assinatura ainda ativa — se o aluno
    desistiu, para de gerar sozinho."""
    if admin.role == Role.ADMIN_POINT and admin.point_id != point_id:
        raise HTTPException(403, "Sem permissão para este Point")

    matriculas = (
        db.query(Matricula)
        .join(Assinatura, Matricula.assinatura_id == Assinatura.id)
        .filter(
            Assinatura.point_id == point_id,
            Assinatura.status == MatriculaStatus.ATIVA,
            Matricula.status == MatriculaStatus.ATIVA,
        )
        .all()
    )

    total = sum(gerar_aulas_do_mes(db, m, date.today()) for m in matriculas)
    db.commit()
    return {"aulas_geradas": total}
