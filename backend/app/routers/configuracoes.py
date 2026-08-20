from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.configuracao import ConfiguracaoPlataforma
from app.models.enums import Role
from app.models.user import User
from app.schemas.configuracao import ConfiguracaoOut, ConfiguracaoUpdate

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])


def _get_ou_criar(db: Session) -> ConfiguracaoPlataforma:
    config = db.get(ConfiguracaoPlataforma, 1)
    if config is None:
        # Semente com a taxa combinada em agosto/2026 (R$ 1,00) — ajustável a
        # qualquer momento pelo dono do app, neste mesmo endpoint (seção 2).
        config = ConfiguracaoPlataforma(id=1, taxa_servico=1.00)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("", response_model=ConfiguracaoOut)
def obter_configuracao(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConfiguracaoPlataforma:
    return _get_ou_criar(db)


@router.patch("", response_model=ConfiguracaoOut)
def atualizar_configuracao(
    payload: ConfiguracaoUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConfiguracaoPlataforma:
    config = _get_ou_criar(db)
    config.taxa_servico = payload.taxa_servico
    db.commit()
    db.refresh(config)
    return config
