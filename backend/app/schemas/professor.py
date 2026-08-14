from app.schemas.common import ORMModel


class ProfessorCreate(ORMModel):
    nome: str
    contato: str
    email: str | None = None
    modalidades: list[str] = []
    senha: str  # cria o User de login junto com o cadastro do professor


class ProfessorOut(ORMModel):
    id: int
    nome: str
    contato: str
    email: str | None
    modalidades: list[str]
