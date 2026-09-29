from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import Role
from app.models.integracao_log import IntegracaoLog
from app.models.user import User
from app.schemas.integracao_log import IntegracaoLogOut

router = APIRouter(prefix="/integracoes/logs", tags=["integracoes"])

LIMITE_PADRAO = 200
LIMITE_MAXIMO = 500


@router.get("", response_model=list[IntegracaoLogOut])
def listar_logs(
    db: Annotated[Session, Depends(get_db)],
    _dono: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
    integracao: str | None = None,
    somente_erros: bool = False,
    limit: int = LIMITE_PADRAO,
) -> list[IntegracaoLog]:
    """Log de toda chamada às integrações externas (pedido do usuário,
    2026-09-29: "gostaria de ter uma tela de logs de integrações, assim
    fico sabendo se tá dando erro ou não") — só o dono do app vê ("essa
    tela só quem vê é o adm do sistema"), é diagnóstico da plataforma
    inteira. Mais recente primeiro."""
    query = db.query(IntegracaoLog)
    if integracao:
        query = query.filter(IntegracaoLog.integracao == integracao)
    if somente_erros:
        query = query.filter(IntegracaoLog.sucesso.is_(False))
    return (
        query.order_by(IntegracaoLog.criado_em.desc())
        .limit(min(max(limit, 1), LIMITE_MAXIMO))
        .all()
    )
