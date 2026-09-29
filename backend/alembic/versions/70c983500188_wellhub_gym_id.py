"""wellhub_gym_id

Revision ID: 70c983500188
Revises: a787e6401502
Create Date: 2026-09-29 00:00:00.000000

Gym ID da Wellhub (POR Point) — mesmo papel do place_api_key já existente
pra TotalPass, ver app/services/wellhub.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '70c983500188'
down_revision: Union[str, None] = 'a787e6401502'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('points', sa.Column('wellhub_gym_id', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('points', 'wellhub_gym_id')
