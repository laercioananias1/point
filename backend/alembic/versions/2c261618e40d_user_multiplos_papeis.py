"""user_multiplos_papeis

Revision ID: 2c261618e40d
Revises: c8cc7cf0efe9
Create Date: 2026-08-26 20:00:00.000000

Uma conta pode acumular mais de um papel agora (pedido do usuário,
2026-08-26: "o dono do Point é também o professor, como fazemos isso?").
Troca users.role (um valor só) por users.roles (lista JSON) — backfill
direto do valor antigo, sem perder nenhuma conta existente.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2c261618e40d'
down_revision: Union[str, None] = 'c8cc7cf0efe9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('roles', sa.JSON(), nullable=True))
    # role no banco guarda o NOME do membro do enum (ex.: 'ADMIN_POINT'),
    # maiúsculo — mas Role.value (o que o código usa em toda parte, incl.
    # User.tem_role) é minúsculo ('admin_point'). Sem o LOWER() aqui toda
    # checagem de papel quebraria silenciosamente pra quem já existia antes
    # desta migração.
    op.execute("UPDATE users SET roles = JSON_ARRAY(LOWER(role))")
    op.alter_column('users', 'roles', existing_type=sa.JSON(), nullable=False)
    op.drop_column('users', 'role')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'role',
            sa.Enum('SUPER_ADMIN', 'ADMIN_POINT', 'PROFESSOR', 'ALUNO', name='role'),
            nullable=True,
        ),
    )
    # Downgrade pega só o primeiro papel de cada conta — se alguma tiver
    # ganhado um segundo papel depois do upgrade, essa informação se perde
    # ao voltar (esperado: o downgrade é pro schema antigo, que só suportava
    # um). UPPER() de volta, pra bater com o enum do banco.
    op.execute("UPDATE users SET role = UPPER(JSON_UNQUOTE(JSON_EXTRACT(roles, '$[0]')))")
    op.alter_column('users', 'role', existing_type=sa.Enum(
        'SUPER_ADMIN', 'ADMIN_POINT', 'PROFESSOR', 'ALUNO', name='role',
    ), nullable=False)
    op.drop_column('users', 'roles')
