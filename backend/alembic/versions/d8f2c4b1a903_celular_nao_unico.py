"""celular_nao_unico

Revision ID: d8f2c4b1a903
Revises: c5b9d3e07a41
Create Date: 2026-08-21 17:00:00.000000

Só e-mail precisa ser único agora — é o login de todo mundo (pedido do
usuário, 2026-08-21: "tira essa trava de celular... trava só em email").
Celular continua obrigatório, só não é mais chave de unicidade.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd8f2c4b1a903'
down_revision: Union[str, None] = 'c5b9d3e07a41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('celular', table_name='users')


def downgrade() -> None:
    op.create_index('celular', 'users', ['celular'], unique=True)
