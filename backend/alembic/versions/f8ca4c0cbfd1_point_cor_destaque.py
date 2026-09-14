"""point_cor_destaque

Revision ID: f8ca4c0cbfd1
Revises: 9001502b256f
Create Date: 2026-09-14 00:00:02.000000

Cor de destaque por Point (pedido do usuário, 2026-09-14: "personalizar
algumas coisas como a Logomarca do point, as cores do portal") —
sobrescreve --accent/--accent-strong/--accent-soft pra quem está logado
naquele Point (ou navegando numa tela pública que já sabe qual Point é,
como convite e aula experimental). Nula = usa a cor padrão do sistema;
toda turma/point existente já cai nesse caso, sem backfill necessário.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f8ca4c0cbfd1'
down_revision: Union[str, None] = '9001502b256f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('points', sa.Column('cor_destaque', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('points', 'cor_destaque')
