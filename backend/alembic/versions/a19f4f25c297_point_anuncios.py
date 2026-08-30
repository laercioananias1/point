"""point_anuncios

Revision ID: a19f4f25c297
Revises: fe6e54b5625d
Create Date: 2026-08-30 22:39:06.080415

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a19f4f25c297'
down_revision: Union[str, None] = 'fe6e54b5625d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Não mexe nos índices 'token' de convites/convites_vinculo — drift
    # pré-existente do autogenerate, sem relação com esta migração.
    op.add_column('points', sa.Column('anuncios', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('points', 'anuncios')
