from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, TrocarSenhaRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    """Login sempre por e-mail (pedido do usuário, 2026-08-21 — celular
    'não dá muito certo' como identificador). Celular continua obrigatório
    no cadastro, só não serve mais pra entrar."""
    user = db.query(User).filter(User.email == payload.email).first()

    if user is None or not verify_password(payload.senha, user.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos")

    # Só "sub" — o token é identidade, não autorização (o papel é sempre
    # lido fresco de user.roles a cada request, ver core/deps.py). Uma
    # conta pode ganhar um papel novo (pedido do usuário, 2026-08-26) sem
    # precisar logar de novo pra isso valer.
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def quem_sou_eu(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Rehidrata a sessão no boot do app (recarregar a página não perde o
    usuário, só o token em memória permanece)."""
    return user


@router.patch("/senha", status_code=204)
def trocar_senha(
    payload: TrocarSenhaRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Trocar a própria senha (pedido do usuário, 2026-08-31 — até aqui só
    dava pra trocar direto no banco, sem tela nenhuma). Pede a senha atual
    de novo — mesmo já autenticado por token — pra confirmar que quem está
    fazendo isso é o dono da conta, não alguém com a sessão aberta numa
    máquina compartilhada."""
    if not verify_password(payload.senha_atual, user.senha_hash):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Senha atual incorreta")
    if len(payload.senha_nova) < 6:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "A nova senha precisa ter pelo menos 6 caracteres"
        )
    user.senha_hash = hash_password(payload.senha_nova)
    db.commit()
