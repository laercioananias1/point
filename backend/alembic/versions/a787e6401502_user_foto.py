"""user_foto

Revision ID: a787e6401502
Revises: d78305ae0acf
Create Date: 2026-09-21 00:00:00.000000

Foto de perfil do usuário (pedido do usuário, 2026-09-21).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a787e6401502'
down_revision: Union[str, None] = 'd78305ae0acf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('foto', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'foto')
