from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import Role
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou expirado")

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário não encontrado")

    return user


def require_role(*allowed: Role):
    """Dependency factory: `Depends(require_role(Role.ADMIN_POINT))`.

    Só decide QUEM pode chamar o endpoint. O recorte de DADOS (ex.: só o Point
    do admin, só o vínculo do professor) é responsabilidade de cada router —
    ver a nota de isolamento por vinculo_id no plano de arquitetura (seção 4).

    Uma conta pode ter mais de um papel agora (pedido do usuário, 2026-08-26
    — dono do Point que também é professor) — basta ter QUALQUER UM dos
    papéis pedidos, não precisa ser o único papel da conta.
    """

    def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not any(user.tem_role(role) for role in allowed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem permissão para este recurso")
        return user

    return dependency
