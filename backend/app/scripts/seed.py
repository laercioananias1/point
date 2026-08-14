"""Cria o primeiro usuário super_admin, para dar acesso inicial ao sistema.

Uso (dentro do container da API):
    docker compose exec api python -m app.scripts.seed
"""

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import Role
from app.models.user import User

SUPER_ADMIN_CELULAR = "+5511900000000"
SUPER_ADMIN_SENHA = "troque-esta-senha"


def run() -> None:
    db = SessionLocal()
    try:
        if db.query(User).filter(User.celular == SUPER_ADMIN_CELULAR).first():
            print("Super admin já existe — nada a fazer.")
            return

        user = User(
            nome="Dono do App",
            celular=SUPER_ADMIN_CELULAR,
            senha_hash=hash_password(SUPER_ADMIN_SENHA),
            role=Role.SUPER_ADMIN,
        )
        db.add(user)
        db.commit()
        print(f"Super admin criado — celular: {SUPER_ADMIN_CELULAR} / senha: {SUPER_ADMIN_SENHA}")
        print("Troque a senha antes de ir para produção.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
