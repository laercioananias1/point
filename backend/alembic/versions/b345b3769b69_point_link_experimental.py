"""point_link_experimental

Revision ID: b345b3769b69
Revises: f8ca4c0cbfd1
Create Date: 2026-09-14 00:00:03.000000

Token opaco pro link público de aula experimental (pedido do usuário,
2026-09-14: "colocar o id visivel nao é uma boa... criar uma hash mas
nao identificar o id na url") — a URL /experimental/{link} passa a usar
isso em vez do id sequencial do Point, pra não dar pra enumerar todos os
clientes só trocando o número. Backfill gera um token por Point já
existente antes de travar a coluna como NOT NULL + único.
"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b345b3769b69'
down_revision: Union[str, None] = 'f8ca4c0cbfd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('points', sa.Column('link_experimental', sa.String(length=16), nullable=True))

    conexao = op.get_bind()
    ids = [row[0] for row in conexao.execute(sa.text('SELECT id FROM points')).fetchall()]
    for point_id in ids:
        token = secrets.token_urlsafe(6)
        conexao.execute(
            sa.text('UPDATE points SET link_experimental = :token WHERE id = :id'),
            {'token': token, 'id': point_id},
        )

    op.alter_column('points', 'link_experimental', existing_type=sa.String(length=16), nullable=False)
    # unique=True + index=True no modelo (Point.link_experimental) viram UM
    # índice único só, não um índice + uma constraint separados.
    op.create_index(
        op.f('ix_points_link_experimental'), 'points', ['link_experimental'], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_points_link_experimental'), table_name='points')
    op.drop_column('points', 'link_experimental')
