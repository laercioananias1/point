from app.models.enums import Role
from app.schemas.common import ORMModel


class LoginRequest(ORMModel):
    identificador: str  # celular ou e-mail
    senha: str


class UserOut(ORMModel):
    id: int
    nome: str
    role: Role
    # Só preenchido pra admin_point — é o que o painel usa pra filtrar
    # dados do próprio Point (ex.: listar turmas pra cancelar por força maior)
    # sem precisar de mais uma chamada.
    point_id: int | None = None


class TokenResponse(ORMModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
