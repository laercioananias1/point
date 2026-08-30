from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import MatriculaTipo, PagamentoMeio, PagamentoStatus, Role
from app.models.matricula import Matricula
from app.models.pagamento import Pagamento
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.pagamento import PagamentoCreate, PagamentoOut
from app.services.aulas import gerar_aulas_do_mes

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])


def _to_out(pagamento: Pagamento) -> PagamentoOut:
    return PagamentoOut(
        id=pagamento.id,
        valor=pagamento.valor,
        meio=pagamento.meio,
        status=pagamento.status,
        registrado_por_id=pagamento.registrado_por_id,
        mes_referencia=pagamento.mes_referencia,
        aulas_cobertas=pagamento.aulas_cobertas,
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
    """Nasce PENDENTE (pedido do usuário, 2026-08-21: "o aluno só informa que
    pagou, não tem nenhuma conferência?" — tinha razão, o Pix confirmava
    sozinho na hora, sem checar nada real). O MVP ainda não integra um
    gateway de verdade (seção 7) — não dá pra confirmar Pix sozinho de
    forma confiável sem isso —, então passa pela mesma conferência manual
    do admin do Point (que olha o extrato Pix da conta do Point e confirma
    ou estorna).

    Só Pix é aceito (pedido do usuário, 2026-08-26: "vou retirar do sistema
    a forma de pagamento em dinheiro") — só o próprio aluno pode lançar
    (declarar) o pagamento da própria matrícula; não existe mais lançamento
    em dinheiro pelo professor/admin (seção 4.3, revogado).

    Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21): pra
    matrícula mensal, cada pagamento cobre o mês corrente (mes_referencia) —
    não dá pra lançar um novo enquanto já existe um pendente ou confirmado
    desse mesmo mês. Matrícula avulsa continua sem mês (pagamento único)."""
    if payload.meio != PagamentoMeio.PIX:
        raise HTTPException(422, "Este Point só aceita pagamento via Pix")

    matricula = db.get(Matricula, payload.matricula_id)
    if matricula is None:
        raise HTTPException(404, "Matrícula não encontrada")

    if not user.tem_role(Role.ALUNO) or matricula.aluno_id != user.aluno_id:
        raise HTTPException(403, "Só o próprio aluno pode pagar a sua matrícula via Pix")

    mes_referencia = None
    if matricula.tipo == MatriculaTipo.MENSAL:
        mes_referencia = date.today().replace(day=1)
        ja_tem = (
            db.query(Pagamento)
            .filter(
                Pagamento.matricula_id == matricula.id,
                Pagamento.mes_referencia == mes_referencia,
                Pagamento.status.in_([PagamentoStatus.PENDENTE, PagamentoStatus.CONFIRMADO]),
            )
            .first()
        )
        if ja_tem is not None:
            raise HTTPException(409, "Já existe um pagamento deste mês em aberto ou confirmado")

    pagamento = Pagamento(
        matricula_id=matricula.id,
        valor=payload.valor,
        meio=payload.meio,
        status=PagamentoStatus.PENDENTE,
        # Sempre nulo agora — só o próprio aluno lança (Pix), nunca um
        # professor/admin "registrando por" ele (dinheiro foi removido).
        registrado_por_id=None,
        mes_referencia=mes_referencia,
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
    """Sem gateway de verdade, é o admin do Point quem confere (extrato Pix
    da conta do Point) antes de confirmar (pedido do usuário, 2026-08-21).
    Dinheiro deixou de ser aceito (pedido do usuário, 2026-08-26).

    Gera as aulas do mês na hora pra essa matrícula (pedido do usuário,
    2026-08-30: "se for pra ter só quando o aluno regularizar, deixa
    automático nesse momento, e não eu ter que fazer isso manualmente") —
    antes só rolava no job diário de madrugada (scheduler) ou no botão
    manual "Gerar aulas do mês agora", que existia só por causa disso.
    Continua batendo sozinho todo dia às 04:00 pra quem já tava em dia
    desde antes; isso aqui só cobre o "acabou de regularizar" sem esperar."""
    pagamento = _get_pagamento_do_point_do_admin(db, pagamento_id, admin)
    if pagamento.status != PagamentoStatus.PENDENTE:
        raise HTTPException(422, "Só um pagamento pendente pode ser confirmado")

    pagamento.status = PagamentoStatus.CONFIRMADO
    gerar_aulas_do_mes(db, pagamento.matricula)
    db.commit()
    db.refresh(pagamento)
    return _to_out(pagamento)


@router.patch("/{pagamento_id}/estornar", response_model=PagamentoOut)
def estornar_pagamento(
    pagamento_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> PagamentoOut:
    """Também serve como 'recusar' um Pix declarado errado — o enum não
    distingue os dois casos (seção 3, tabela de entidades)."""
    pagamento = _get_pagamento_do_point_do_admin(db, pagamento_id, admin)
    pagamento.status = PagamentoStatus.ESTORNADO
    db.commit()
    db.refresh(pagamento)
    return _to_out(pagamento)
