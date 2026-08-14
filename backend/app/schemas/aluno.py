from app.models.enums import FormaPagamento
from app.schemas.common import ORMModel


class AlunoCreate(ORMModel):
    nome: str
    contato: str
    email: str | None = None
    forma_pagamento_preferida: FormaPagamento
    senha: str  # cria o User de login junto com o cadastro do aluno


class AlunoOut(ORMModel):
    id: int
    nome: str
    contato: str
    email: str | None
    forma_pagamento_preferida: FormaPagamento
