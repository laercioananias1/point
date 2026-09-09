"""remove_professor_modalidades

Revision ID: 11319c48e3f6
Revises: 27ae1cb32272
Create Date: 2026-09-08 00:00:00.000000

Professor.modalidades nunca era preenchido por nenhum fluxo real do sistema
(pedido do usuário, 2026-09-08: "não faz sentido, pode remover do banco
também") — toda criação de Professor (aceitar convite de vínculo, virar
professor do próprio Point) sempre passava modalidades=[]; o único endpoint
que aceitava um valor (POST /professores) não tem nenhuma tela chamando ele.
Campo morto — removido do model, dos schemas e agora da tabela.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '11319c48e3f6'
down_revision: Union[str, None] = '27ae1cb32272'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('professores', 'modalidades')


def downgrade() -> None:
    op.add_column(
        'professores',
        sa.Column('modalidades', sa.JSON(), nullable=False, server_default=sa.text('(JSON_ARRAY())')),
    )
