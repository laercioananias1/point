"""dia_vencimento_mensalidade

Revision ID: c8cc7cf0efe9
Revises: e6de31dd6481
Create Date: 2026-08-21 21:00:00.000000

Dia do mês em que a mensalidade vence (pedido do usuário, 2026-08-21: "a
data de pagamento tem vencimento?"). Antes só existia o prazo implícito de
fim de mês; agora cada Point pode configurar o próprio dia (padrão 10).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8cc7cf0efe9'
down_revision: Union[str, None] = 'e6de31dd6481'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'points',
        sa.Column('dia_vencimento_mensalidade', sa.Integer(), nullable=False, server_default='10'),
    )


def downgrade() -> None:
    op.drop_column('points', 'dia_vencimento_mensalidade')
