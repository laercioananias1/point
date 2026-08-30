"""point_banners

Revision ID: 6a5f4185b7f0
Revises: a19f4f25c297
Create Date: 2026-08-30 22:46:20.951799

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6a5f4185b7f0'
down_revision: Union[str, None] = 'a19f4f25c297'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Não mexe nos índices 'token' de convites/convites_vinculo — drift
    # pré-existente do autogenerate, sem relação com esta migração.
    # server_default só pra popular as linhas já existentes (Point.banners
    # é NOT NULL) — o default de verdade pra linha nova é o `default=list`
    # do model, no lado do Python.
    op.add_column(
        'points',
        sa.Column('banners', sa.JSON(), nullable=False, server_default=sa.text('(JSON_ARRAY())')),
    )


def downgrade() -> None:
    op.drop_column('points', 'banners')
