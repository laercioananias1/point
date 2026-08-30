"""point_logo

Revision ID: 8135db14a42b
Revises: 6a5f4185b7f0
Create Date: 2026-08-30 22:58:44.891866

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8135db14a42b'
down_revision: Union[str, None] = '6a5f4185b7f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Não mexe nos índices 'token' de convites/convites_vinculo — drift
    # pré-existente do autogenerate, sem relação com esta migração.
    op.add_column('points', sa.Column('logo', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('points', 'logo')
