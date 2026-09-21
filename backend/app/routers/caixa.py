import calendar
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.caixa import ContaCaixa, LancamentoCaixa, LancamentoFixo
from app.models.enums import Role
from app.models.user import User
from app.schemas.caixa import (
    ContaCaixaCreate,
    ContaCaixaOut,
    LancamentoCreate,
    LancamentoOut,
    LancamentoUpdate,
)

router = APIRouter(prefix="/caixa", tags=["caixa"])

Admin = Annotated[User, Depends(require_role(Role.ADMIN_POINT))]
DB = Annotated[Session, Depends(get_db)]


def _checar_conta(db: Session, conta_id: int | None, admin: User) -> None:
    if conta_id is None:
        return
    conta = db.get(ContaCaixa, conta_id)
    if conta is None or conta.point_id != admin.point_id:
        raise HTTPException(404, "Conta não encontrada")


def _get_lancamento(db: Session, lancamento_id: int, admin: User) -> LancamentoCaixa:
    lancamento = db.get(LancamentoCaixa, lancamento_id)
    if lancamento is None or lancamento.point_id != admin.point_id:
        raise HTTPException(404, "Lançamento não encontrado")
    return lancamento


def _to_out(lancamento: LancamentoCaixa) -> LancamentoOut:
    return LancamentoOut.model_validate(lancamento)


@router.get("/lancamentos", response_model=list[LancamentoOut])
def listar_lancamentos(
    db: DB, admin: Admin, inicio: date | None = None, fim: date | None = None
) -> list[LancamentoOut]:
    """Lançamentos do período (padrão: mês corrente), mais recentes
    primeiro."""
    hoje = date.today()
    inicio = inicio or hoje.replace(day=1)
    fim = fim or hoje.replace(day=calendar.monthrange(hoje.year, hoje.month)[1])
    lancamentos = (
        db.query(LancamentoCaixa)
        .filter(
            LancamentoCaixa.point_id == admin.point_id,
            LancamentoCaixa.data >= inicio,
            LancamentoCaixa.data <= fim,
        )
        .order_by(LancamentoCaixa.data.desc(), LancamentoCaixa.id.desc())
        .all()
    )
    return [_to_out(lancamento) for lancamento in lancamentos]


@router.post("/lancamentos", response_model=LancamentoOut, status_code=201)
def criar_lancamento(payload: LancamentoCreate, db: DB, admin: Admin) -> LancamentoOut:
    _checar_conta(db, payload.conta_id, admin)

    fixo_id = None
    mes_referencia = None
    if payload.recorrente:
        fixo = LancamentoFixo(
            point_id=admin.point_id,
            tipo=payload.tipo,
            descricao=payload.descricao.strip(),
            valor=payload.valor,
            dia=payload.data.day,
            conta_id=payload.conta_id,
        )
        db.add(fixo)
        db.flush()
        fixo_id = fixo.id
        # Este primeiro lançamento já é o do mês da data — o job só cria os
        # próximos, sem duplicar (fixo + mês é único).
        mes_referencia = payload.data.replace(day=1)

    lancamento = LancamentoCaixa(
        point_id=admin.point_id,
        tipo=payload.tipo,
        descricao=payload.descricao.strip(),
        valor=payload.valor,
        data=payload.data,
        conta_id=payload.conta_id,
        fixo_id=fixo_id,
        mes_referencia=mes_referencia,
    )
    db.add(lancamento)
    db.commit()
    db.refresh(lancamento)
    return _to_out(lancamento)


@router.patch("/lancamentos/{lancamento_id}", response_model=LancamentoOut)
def editar_lancamento(
    lancamento_id: int, payload: LancamentoUpdate, db: DB, admin: Admin
) -> LancamentoOut:
    lancamento = _get_lancamento(db, lancamento_id, admin)
    if lancamento.automatico:
        raise HTTPException(
            422, "Entrada automática — pra alterar, desfaça o pagamento na tela de Cobranças"
        )
    if "conta_id" in payload.model_fields_set:
        _checar_conta(db, payload.conta_id, admin)
        lancamento.conta_id = payload.conta_id
    if payload.tipo is not None:
        lancamento.tipo = payload.tipo
    if payload.descricao is not None:
        lancamento.descricao = payload.descricao.strip()
    if payload.valor is not None:
        lancamento.valor = payload.valor
    if payload.data is not None:
        lancamento.data = payload.data
    db.commit()
    db.refresh(lancamento)
    return _to_out(lancamento)


@router.delete("/lancamentos/{lancamento_id}", status_code=204)
def remover_lancamento(lancamento_id: int, db: DB, admin: Admin) -> None:
    lancamento = _get_lancamento(db, lancamento_id, admin)
    if lancamento.automatico:
        raise HTTPException(
            422, "Entrada automática — pra remover, desfaça o pagamento na tela de Cobranças"
        )
    db.delete(lancamento)
    db.commit()


@router.delete("/fixos/{fixo_id}", status_code=204)
def parar_de_repetir(fixo_id: int, db: DB, admin: Admin) -> None:
    """Desativa o lançamento fixo — o que já foi lançado continua no caixa."""
    fixo = db.get(LancamentoFixo, fixo_id)
    if fixo is None or fixo.point_id != admin.point_id:
        raise HTTPException(404, "Lançamento fixo não encontrado")
    fixo.ativo = False
    db.commit()


@router.get("/contas", response_model=list[ContaCaixaOut])
def listar_contas(db: DB, admin: Admin) -> list[ContaCaixa]:
    return (
        db.query(ContaCaixa)
        .filter(ContaCaixa.point_id == admin.point_id)
        .order_by(ContaCaixa.nome)
        .all()
    )


@router.post("/contas", response_model=ContaCaixaOut, status_code=201)
def criar_conta(payload: ContaCaixaCreate, db: DB, admin: Admin) -> ContaCaixa:
    nome = payload.nome.strip()
    existe = (
        db.query(ContaCaixa.id)
        .filter(ContaCaixa.point_id == admin.point_id, ContaCaixa.nome == nome)
        .first()
    )
    if existe is not None:
        raise HTTPException(409, "Já existe uma conta com esse nome")
    conta = ContaCaixa(point_id=admin.point_id, nome=nome)
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta
