"""point_perfil_sobre_fotos

Revision ID: fe6e54b5625d
Revises: 89501d9d5c60
Create Date: 2026-08-30 22:21:57.825643

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'fe6e54b5625d'
down_revision: Union[str, None] = '89501d9d5c60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Não mexe nos índices 'token' de convites/convites_vinculo — drift
    # pré-existente do autogenerate, sem relação com esta migração (mesma
    # limpeza feita nas migrações anteriores desta sessão).
    op.add_column('points', sa.Column('sobre', sa.Text(), nullable=True))
    op.add_column('points', sa.Column('informacoes_importantes', sa.Text(), nullable=True))
    # server_default só pra popular as linhas já existentes (Point.fotos é
    # NOT NULL) — o default de verdade pra linha nova é o `default=list` do
    # model, no lado do Python.
    op.add_column(
        'points',
        sa.Column('fotos', sa.JSON(), nullable=False, server_default=sa.text('(JSON_ARRAY())')),
    )


def downgrade() -> None:
    op.drop_column('points', 'fotos')
    op.drop_column('points', 'informacoes_importantes')
    op.drop_column('points', 'sobre')
