"""cadastro_feriados

Revision ID: d446fc95ccfc
Revises: c4e7a1d8c966
Create Date: 2026-09-03 15:44:33.559208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd446fc95ccfc'
down_revision: Union[str, None] = 'c4e7a1d8c966'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'feriados',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('point_id', sa.Integer(), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['point_id'], ['points.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('point_id', 'data', name='uq_feriado_point_data'),
    )


def downgrade() -> None:
    op.drop_table('feriados')
