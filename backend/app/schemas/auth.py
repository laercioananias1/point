from app.models.enums import Role
from app.schemas.common import ORMModel


class LoginRequest(ORMModel):
    identificador: str  # celular ou e-mail
    senha: str


class UserOut(ORMModel):
    id: int
    nome: str
    role: Role


class TokenResponse(ORMModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
