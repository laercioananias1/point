from app.models.enums import Role
from app.schemas.common import ORMModel


class LoginRequest(ORMModel):
    email: str
    senha: str


class TrocarSenhaRequest(ORMModel):
    """Pedido do usuário, 2026-08-31: "pode construir" (tela de trocar
    senha) — até aqui só existia troca via update direto no banco, ver
    DEPLOY.md. Pede a senha atual pra confirmar que é o dono da conta
    (não só quem está com a sessão aberta na máquina)."""

    senha_atual: str
    senha_nova: str


class UserOut(ORMModel):
    id: int
    nome: str
    # Uma conta pode ter mais de um papel agora (pedido do usuário,
    # 2026-08-26 — dono do Point que também é professor). O frontend decide
    # qual barra de abas mostrar pela ROTA atual, não mais por um único
    # role fixo — ver Layout.tsx.
    roles: list[Role]
    # Só preenchido pra quem tem admin_point — é o que o painel usa pra
    # filtrar dados do próprio Point (ex.: listar turmas pra cancelar por
    # força maior) sem precisar de mais uma chamada.
    point_id: int | None = None


class TokenResponse(ORMModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
