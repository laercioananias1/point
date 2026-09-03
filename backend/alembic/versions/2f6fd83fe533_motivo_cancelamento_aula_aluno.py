"""motivo_cancelamento_aula_aluno

Revision ID: 2f6fd83fe533
Revises: d446fc95ccfc
Create Date: 2026-09-03 16:03:59.739076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2f6fd83fe533'
down_revision: Union[str, None] = 'd446fc95ccfc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('matricula_excecoes', sa.Column('motivo', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('matricula_excecoes', 'motivo')
