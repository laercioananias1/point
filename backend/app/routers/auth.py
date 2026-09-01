import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.redefinicao_senha import RedefinicaoSenha
from app.models.user import User
from app.schemas.auth import EsqueciSenhaRequest, LoginRequest, RedefinirSenhaRequest, TokenResponse, UserOut
from app.services.email import enviar_redefinicao_senha_email

router = APIRouter(prefix="/auth", tags=["auth"])

PRAZO_EXPIRACAO_HORAS = 1


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


@router.post("/esqueci-senha", status_code=204)
def esqueci_senha(payload: EsqueciSenhaRequest, db: Annotated[Session, Depends(get_db)]) -> None:
    """Pede o link de redefinição por e-mail (pedido do usuário,
    2026-09-01: "a troca de senha precisa ser por email" — substitui a
    tela de trocar senha logado, que saiu do Perfil). Sempre responde 204,
    mesmo pra e-mail que não existe — não dá pra alguém descobrir, tentando
    aqui, quais e-mails têm conta na plataforma."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        return

    redefinicao = RedefinicaoSenha(
        token=secrets.token_urlsafe(24),
        user_id=user.id,
        expira_em=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=PRAZO_EXPIRACAO_HORAS),
    )
    db.add(redefinicao)
    db.commit()

    settings = get_settings()
    link = f"{settings.frontend_url}/redefinir-senha/{redefinicao.token}"
    enviar_redefinicao_senha_email(nome=user.nome, email=user.email, link=link)


@router.post("/redefinir-senha", response_model=TokenResponse)
def redefinir_senha(
    payload: RedefinirSenhaRequest, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    """Consome o token do e-mail e troca a senha — devolve a pessoa já
    logada (mesmo padrão de "aceitar convite criando conta nova", ver
    routers/convites_admin.py), pra não precisar fazer login de novo logo
    depois de acabar de trocar a senha."""
    redefinicao = db.query(RedefinicaoSenha).filter(RedefinicaoSenha.token == payload.token).first()
    if redefinicao is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link não encontrado")
    if not redefinicao.valido:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Esse link expirou ou já foi usado")
    if len(payload.senha_nova) < 6:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "A nova senha precisa ter pelo menos 6 caracteres"
        )

    user = redefinicao.user
    user.senha_hash = hash_password(payload.senha_nova)
    redefinicao.usado_em = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(user)

    token_acesso = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token_acesso, user=user)
