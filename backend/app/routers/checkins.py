from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.checkin import Checkin
from app.models.enums import CheckinOrigem, CheckinStatus, Role
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.schemas.checkin import CheckinOut, PresencaMarcar, TotalPassCheckinCreate
from app.services.aulas import matricula_tem_aula_em
from app.services.totalpass import TotalPassError, validar_checkin

router = APIRouter(prefix="/checkins", tags=["checkins"])


def _pode_gerenciar_turma(user: User, turma: Turma) -> bool:
    return (user.tem_role(Role.PROFESSOR) and turma.vinculo.professor_id == user.professor_id) or (
        user.tem_role(Role.ADMIN_POINT) and turma.vinculo.point_id == user.point_id
    )


@router.post("/totalpass", response_model=CheckinOut, status_code=201)
def registrar_checkin_totalpass(
    payload: TotalPassCheckinCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> Checkin:
    """Check-in "livre" de benefício TotalPass (pedido do usuário,
    2026-08-25) — o aluno TotalPass mostra o código do dia na recepção, o
    professor da turma ou o admin do Point digita aqui na hora. Sem
    matrícula nem reserva prévia (decisão do usuário: "check-in livre, sem
    reserva") — só registra que essa pessoa entrou, pra auditoria/controle
    de acesso; não conta como vaga ocupada na turma nem gera cobrança (o
    aluno TotalPass já paga a TotalPass, não o Point diretamente)."""
    turma = db.get(Turma, payload.turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")
    if not _pode_gerenciar_turma(user, turma):
        raise HTTPException(403, "Só o professor da turma ou o admin do Point podem validar check-in")

    point = turma.vinculo.point
    if not point.place_api_key:
        raise HTTPException(
            422, "Esse Point ainda não tem a credencial TotalPass configurada (Configurações)"
        )

    try:
        beneficiario = validar_checkin(
            point_id=point.id, place_api_key=point.place_api_key, codigo=payload.codigo
        )
    except TotalPassError as erro:
        raise HTTPException(422, str(erro)) from erro

    checkin = Checkin(
        turma_id=turma.id,
        data_hora=datetime.now(),
        origem=CheckinOrigem.TOTALPASS,
        status=CheckinStatus.CONFIRMADO,
        beneficiario_nome=beneficiario.get("nome"),
        beneficiario_documento=beneficiario.get("documento"),
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.get("/turma/{turma_id}", response_model=list[CheckinOut])
def listar_checkins_da_turma(
    turma_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
    data: date | None = None,
) -> list[Checkin]:
    """Check-ins dessa turma — pro professor/admin conferir quem já validou
    entrada. Sem `data`, é só os últimos 20 (conferência do dia a dia,
    pedido do usuário, 2026-08-25). Com `data` (pedido do usuário,
    2026-08-26: "marcar presença de cada um"), filtra só aquele dia — é
    assim que a Agenda do professor sabe quem já foi marcado presente numa
    ocorrência específica, sem teto de quantidade."""
    turma = db.get(Turma, turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")
    if not _pode_gerenciar_turma(user, turma):
        raise HTTPException(403, "Sem acesso a essa turma")

    query = db.query(Checkin).filter(Checkin.turma_id == turma_id)
    if data is not None:
        return (
            query.filter(func.date(Checkin.data_hora) == data).order_by(Checkin.data_hora.desc()).all()
        )
    return query.order_by(Checkin.data_hora.desc()).limit(20).all()


@router.post("/presenca", response_model=CheckinOut, status_code=201)
def marcar_presenca(
    payload: PresencaMarcar,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> Checkin:
    """Presença marcada pelo professor (ou admin) na hora da aula (pedido
    do usuário, 2026-08-26: "mostrar também os alunos e um check pra
    marcar presença de cada um") — cria um Checkin de origem 'presumido'
    (é o Point/professor confirmando de próprio punho, sem integração de
    benefício nenhuma). Idempotente: marcar de novo o mesmo aluno na
    mesma data não duplica, só devolve o check-in que já existia."""
    turma = db.get(Turma, payload.turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")
    if not _pode_gerenciar_turma(user, turma):
        raise HTTPException(403, "Sem acesso a essa turma")

    matricula = db.get(Matricula, payload.matricula_id)
    if matricula is None or matricula.turma_id != payload.turma_id:
        raise HTTPException(404, "Matrícula não encontrada nessa turma")
    if not matricula_tem_aula_em(matricula, payload.data):
        raise HTTPException(422, "Esse aluno não tem aula nessa turma nessa data")

    existente = (
        db.query(Checkin)
        .filter(
            Checkin.matricula_id == matricula.id,
            func.date(Checkin.data_hora) == payload.data,
        )
        .first()
    )
    if existente is not None:
        return existente

    checkin = Checkin(
        turma_id=turma.id,
        matricula_id=matricula.id,
        data_hora=datetime.combine(payload.data, time.fromisoformat(turma.horario)),
        origem=CheckinOrigem.PRESUMIDO,
        status=CheckinStatus.CONFIRMADO,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.delete("/presenca", status_code=204)
def desmarcar_presenca(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
    turma_id: int,
    matricula_id: int,
    data: date,
) -> None:
    """Desfaz uma presença marcada por engano (pedido do usuário,
    2026-08-26: é um check — precisa dar pra desmarcar)."""
    turma = db.get(Turma, turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")
    if not _pode_gerenciar_turma(user, turma):
        raise HTTPException(403, "Sem acesso a essa turma")

    db.query(Checkin).filter(
        Checkin.matricula_id == matricula_id,
        Checkin.turma_id == turma_id,
        func.date(Checkin.data_hora) == data,
    ).delete(synchronize_session=False)
    db.commit()
