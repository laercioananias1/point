"""email_obrigatorio

Revision ID: f4a1b6c7d802
Revises: e2f5a8c9d104
Create Date: 2026-08-21 14:00:00.000000

Login passa a ser sempre por e-mail, não mais celular (pedido do usuário,
2026-08-21) — e-mail vira obrigatório em users/professores/alunos. Preenche
qualquer linha existente sem e-mail com um placeholder antes de travar a
coluna como NOT NULL, pra migration não falhar em dado legado.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a1b6c7d802'
down_revision: Union[str, None] = 'e2f5a8c9d104'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET email = CONCAT('sem-email-', id, '@placeholder.local') "
        "WHERE email IS NULL"
    )
    op.execute(
        "UPDATE professores SET email = CONCAT('sem-email-', id, '@placeholder.local') "
        "WHERE email IS NULL"
    )
    op.execute(
        "UPDATE alunos SET email = CONCAT('sem-email-', id, '@placeholder.local') "
        "WHERE email IS NULL"
    )

    op.alter_column('users', 'email', existing_type=sa.String(255), nullable=False)
    op.alter_column('professores', 'email', existing_type=sa.String(255), nullable=False)
    op.alter_column('alunos', 'email', existing_type=sa.String(255), nullable=False)


def downgrade() -> None:
    op.alter_column('alunos', 'email', existing_type=sa.String(255), nullable=True)
    op.alter_column('professores', 'email', existing_type=sa.String(255), nullable=True)
    op.alter_column('users', 'email', existing_type=sa.String(255), nullable=True)
