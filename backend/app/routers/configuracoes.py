from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.configuracao import ConfiguracaoPlataforma
from app.models.enums import Role
from app.models.user import User
from app.schemas.configuracao import ConfiguracaoOut, ConfiguracaoUpdate
from app.services.configuracao import get_ou_criar_configuracao

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])


@router.get("", response_model=ConfiguracaoOut)
def obter_configuracao(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConfiguracaoPlataforma:
    return get_ou_criar_configuracao(db)


@router.patch("", response_model=ConfiguracaoOut)
def atualizar_configuracao(
    payload: ConfiguracaoUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConfiguracaoPlataforma:
    config = get_ou_criar_configuracao(db)
    config.taxa_servico = payload.taxa_servico
    db.commit()
    db.refresh(config)
    return config
