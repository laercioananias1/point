from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import PagamentoMeio, PagamentoStatus, Role
from app.models.matricula import Matricula
from app.models.pagamento import Pagamento
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.pagamento import PagamentoCreate, PagamentoOut

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])


def _to_out(pagamento: Pagamento) -> PagamentoOut:
    return PagamentoOut(
        id=pagamento.id,
        valor=pagamento.valor,
        meio=pagamento.meio,
        status=pagamento.status,
        registrado_por_id=pagamento.registrado_por_id,
        matricula_id=pagamento.matricula_id,
        aluno_nome=pagamento.matricula.aluno.nome,
        turma_modalidade=pagamento.matricula.turma.modalidade.nome,
    )


def _get_pagamento_do_point_do_admin(db: Session, pagamento_id: int, admin: User) -> Pagamento:
    pagamento = (
        db.query(Pagamento)
        .join(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Pagamento.id == pagamento_id, Vinculo.point_id == admin.point_id)
        .first()
    )
    if pagamento is None:
        raise HTTPException(404, "Pagamento não encontrado")
    return pagamento


@router.post("", response_model=PagamentoOut, status_code=201)
def lancar_pagamento(
    payload: PagamentoCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PagamentoOut:
    """Pix e dinheiro têm regras bem diferentes aqui (seção 6.1):

    - Pix: só o próprio aluno pode pagar a própria matrícula. O MVP ainda não
      integra um gateway de verdade (seção 7) — o pagamento nasce CONFIRMADO,
      simulando o processamento em tempo real.
    - Dinheiro: só o professor da turma ou o admin do Point podem lançar
      (seção 4.3). Nasce PENDENTE — o admin do Point precisa validar antes de
      contar como pago (decisão de negócio confirmada em 2026-08-19)."""
    matricula = db.get(Matricula, payload.matricula_id)
    if matricula is None:
        raise HTTPException(404, "Matrícula não encontrada")

    if payload.meio == PagamentoMeio.PIX:
        if user.role != Role.ALUNO or matricula.aluno_id != user.aluno_id:
            raise HTTPException(403, "Só o próprio aluno pode pagar a sua matrícula via Pix")
        status_ = PagamentoStatus.CONFIRMADO
        registrado_por_id = None
    else:
        vinculo = matricula.turma.vinculo
        pode_lancar = (
            user.role == Role.PROFESSOR and vinculo.professor_id == user.professor_id
        ) or (user.role == Role.ADMIN_POINT and vinculo.point_id == user.point_id)
        if not pode_lancar:
            raise HTTPException(
                403,
                "Só o professor da turma ou o admin do Point podem lançar pagamento em dinheiro",
            )
        status_ = PagamentoStatus.PENDENTE
        registrado_por_id = user.id

    pagamento = Pagamento(
        matricula_id=matricula.id,
        valor=payload.valor,
        meio=payload.meio,
        status=status_,
        registrado_por_id=registrado_por_id,
    )
    db.add(pagamento)
    db.commit()
    db.refresh(pagamento)
    return _to_out(pagamento)


@router.get("", response_model=list[PagamentoOut])
def listar_pagamentos_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[PagamentoOut]:
    pagamentos = (
        db.query(Pagamento)
        .join(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Vinculo.point_id == admin.point_id)
        .all()
    )
    return [_to_out(p) for p in pagamentos]


@router.patch("/{pagamento_id}/confirmar", response_model=PagamentoOut)
def confirmar_pagamento(
    pagamento_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> PagamentoOut:
    pagamento = _get_pagamento_do_point_do_admin(db, pagamento_id, admin)
    if pagamento.meio != PagamentoMeio.DINHEIRO:
        raise HTTPException(422, "Só pagamentos em dinheiro passam por validação manual")

    pagamento.status = PagamentoStatus.CONFIRMADO
    db.commit()
    db.refresh(pagamento)
    return _to_out(pagamento)


@router.patch("/{pagamento_id}/estornar", response_model=PagamentoOut)
def estornar_pagamento(
    pagamento_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> PagamentoOut:
    """Também serve como 'recusar' um lançamento de dinheiro errado — o enum
    não distingue os dois casos (seção 3, tabela de entidades)."""
    pagamento = _get_pagamento_do_point_do_admin(db, pagamento_id, admin)
    pagamento.status = PagamentoStatus.ESTORNADO
    db.commit()
    db.refresh(pagamento)
    return _to_out(pagamento)
