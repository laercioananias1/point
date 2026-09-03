"""motivo_cancelamento_turma_excecao

Revision ID: c4e7a1d8c966
Revises: 4d52440db29c
Create Date: 2026-09-03 15:16:08.927909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e7a1d8c966'
down_revision: Union[str, None] = '4d52440db29c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('turma_excecoes', sa.Column('motivo', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('turma_excecoes', 'motivo')
