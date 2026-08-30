"""prazo_cancelamento_horas

Revision ID: b7d3f2a91c40
Revises: a1b2c3d4e5f6
Create Date: 2026-08-21 10:00:00.000000

Antecedência mínima (em horas) pra aluno cancelar uma aula com crédito,
configurável por Point (pedido do usuário, 2026-08-21). Padrão 2h.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d3f2a91c40'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'points',
        sa.Column('prazo_cancelamento_horas', sa.Integer(), server_default='2', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('points', 'prazo_cancelamento_horas')
