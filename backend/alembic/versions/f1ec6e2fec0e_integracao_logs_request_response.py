"""integracao_logs_request_response

Revision ID: f1ec6e2fec0e
Revises: 54150df286fd
Create Date: 2026-09-29 00:00:00.000000

Corpo da requisição e da resposta HTTP de cada chamada (pedido do
usuário, 2026-09-29: "quero ver tb o request e response").
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1ec6e2fec0e'
down_revision: Union[str, None] = '54150df286fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('integracao_logs', sa.Column('request_corpo', sa.Text(), nullable=True))
    op.add_column('integracao_logs', sa.Column('response_corpo', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('integracao_logs', 'response_corpo')
    op.drop_column('integracao_logs', 'request_corpo')
