from app.models.enums import FormaPagamento
from app.schemas.common import ORMModel


class AlunoCreate(ORMModel):
    nome: str
    contato: str
    # Obrigatório — login é sempre por e-mail (pedido do usuário, 2026-08-21).
    email: str
    forma_pagamento_preferida: FormaPagamento
    senha: str  # cria o User de login junto com o cadastro do aluno


class AlunoOut(ORMModel):
    id: int
    nome: str
    contato: str
    email: str
    forma_pagamento_preferida: FormaPagamento
