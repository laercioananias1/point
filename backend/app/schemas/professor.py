from app.schemas.common import ORMModel


class ProfessorCreate(ORMModel):
    nome: str
    contato: str
    # Obrigatório — login é sempre por e-mail (pedido do usuário, 2026-08-21).
    email: str
    modalidades: list[str] = []
    senha: str  # cria o User de login junto com o cadastro do professor


class ProfessorOut(ORMModel):
    id: int
    nome: str
    contato: str
    email: str
    modalidades: list[str]
