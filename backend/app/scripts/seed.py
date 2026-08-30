"""Popula a base com as 4 contas de demonstração (pedido do usuário,
2026-08-21) — um usuário por papel, login sempre por e-mail.

Uso (dentro do container da API):
    docker compose exec api python -m app.scripts.seed
"""

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.aluno import Aluno
from app.models.enums import FormaPagamento, Role
from app.models.point import Point
from app.models.professor import Professor
from app.models.user import User

SENHA_PADRAO = "teste123"

CONTAS = [
    {
        "nome": "Laercio Ananias",
        "email": "laercio.ananias@gmail.com",
        "celular": "+5511900000001",
        "roles": [Role.SUPER_ADMIN],
    },
    {
        # Também é professor de propósito (pedido do usuário, 2026-08-26:
        # "o dono do Point é também o professor") — demonstra o papel
        # híbrido: uma conta só, duas áreas (admin_point + professor).
        "nome": "Admin Teste",
        "email": "adm@teste.com.br",
        "celular": "+5511900000002",
        "roles": [Role.ADMIN_POINT, Role.PROFESSOR],
    },
    {
        "nome": "Professor Teste",
        "email": "professor@teste.com.br",
        "celular": "+5511900000003",
        "roles": [Role.PROFESSOR],
    },
    {
        "nome": "Aluno Teste",
        "email": "aluno@teste.com.br",
        "celular": "+5511900000004",
        "roles": [Role.ALUNO],
    },
]


def run() -> None:
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email.in_([c["email"] for c in CONTAS])).first():
            print("Alguma dessas contas já existe — nada a fazer.")
            return

        point = Point(nome="Arena Praia Sul", endereco="Av. Beira Mar, 100")
        db.add(point)
        db.flush()

        professor = Professor(
            nome="Professor Teste", contato="+5511900000003", email="professor@teste.com.br",
            modalidades=[],
        )
        db.add(professor)

        # Professor "de si mesmo" do admin híbrido (pedido do usuário,
        # 2026-08-26) — pessoa própria, diferente de "Professor Teste".
        professor_admin = Professor(
            nome="Admin Teste", contato="+5511900000002", email="adm@teste.com.br",
            modalidades=[],
        )
        db.add(professor_admin)

        aluno = Aluno(
            nome="Aluno Teste", contato="+5511900000004", email="aluno@teste.com.br",
            forma_pagamento_preferida=FormaPagamento.PIX,
        )
        db.add(aluno)
        db.flush()

        for conta in CONTAS:
            roles = conta["roles"]
            db.add(
                User(
                    nome=conta["nome"],
                    email=conta["email"],
                    celular=conta["celular"],
                    senha_hash=hash_password(SENHA_PADRAO),
                    roles=[r.value for r in roles],
                    point_id=point.id if Role.ADMIN_POINT in roles else None,
                    professor_id=(
                        professor_admin.id
                        if Role.ADMIN_POINT in roles and Role.PROFESSOR in roles
                        else professor.id
                        if Role.PROFESSOR in roles
                        else None
                    ),
                    aluno_id=aluno.id if Role.ALUNO in roles else None,
                )
            )

        db.commit()
        print("Contas criadas — senha de todas: " + SENHA_PADRAO)
        for conta in CONTAS:
            print(f"  {'+'.join(r.value for r in conta['roles'])}: {conta['email']}")
        print("Troque as senhas antes de ir para produção.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
