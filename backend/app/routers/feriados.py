from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.enums import Role
from app.models.feriado import Feriado
from app.models.user import User
from app.schemas.feriado import FeriadoCreate, FeriadoOut
from app.services.feriados import feriados_do_periodo

router = APIRouter(prefix="/feriados", tags=["feriados"])


@router.get("", response_model=list[FeriadoOut])
def listar_feriados(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    point_id: int,
    ano: int,
) -> list[FeriadoOut]:
    """Feriados nacionais (calculados) + locais desse Point, pro ano
    inteiro (pedido do usuário, 2026-09-01) — qualquer usuário logado pode
    ver; o professor também precisa saber pra não tentar marcar aula
    nesses dias."""
    inicio, fim = date(ano, 1, 1), date(ano, 12, 31)
    mapa = feriados_do_periodo(db, point_id, inicio, fim)
    locais_ids = {
        f.data: f.id
        for f in db.query(Feriado).filter(
            Feriado.point_id == point_id, Feriado.data >= inicio, Feriado.data <= fim
        )
    }
    return sorted(
        (
            FeriadoOut(id=locais_ids.get(d), data=d, nome=nome, nacional=d not in locais_ids)
            for d, nome in mapa.items()
        ),
        key=lambda f: f.data,
    )


@router.post("", response_model=FeriadoOut, status_code=201)
def cadastrar_feriado(
    payload: FeriadoCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> FeriadoOut:
    """Feriado local (pedido do usuário, 2026-09-01: "o admin pode
    cadastrar seus feriados locais") — some da agenda pro Point inteiro
    (gerar_aulas_do_mes pula essa data, igual TurmaExcecao)."""
    ja_existe = (
        db.query(Feriado)
        .filter(Feriado.point_id == admin.point_id, Feriado.data == payload.data)
        .first()
    )
    if ja_existe:
        raise HTTPException(409, "Já existe um feriado local cadastrado nessa data")

    feriado = Feriado(point_id=admin.point_id, data=payload.data, nome=payload.nome)
    db.add(feriado)
    db.commit()
    db.refresh(feriado)
    return FeriadoOut(id=feriado.id, data=feriado.data, nome=feriado.nome, nacional=False)


@router.delete("/{feriado_id}", status_code=204)
def remover_feriado(
    feriado_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Só remove feriado local — nacional não é uma linha no banco pra
    começo de conversa (calculado, ver services/feriados.py)."""
    feriado = db.get(Feriado, feriado_id)
    if feriado is None or feriado.point_id != admin.point_id:
        raise HTTPException(404, "Feriado não encontrado")
    db.delete(feriado)
    db.commit()
