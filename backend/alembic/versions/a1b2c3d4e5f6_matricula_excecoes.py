"""matricula_excecoes

Revision ID: a1b2c3d4e5f6
Revises: c7a2e9f18b3d
Create Date: 2026-08-20 19:30:00.000000

Cancelamento antecipado de uma aula específica pelo aluno (pedido do
usuário, 2026-08-20) — mesma ideia de TurmaExcecao, mas só pra esse aluno
(a turma continua normal pros outros).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c7a2e9f18b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('matricula_excecoes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('matricula_id', sa.Integer(), nullable=False),
    sa.Column('data', sa.Date(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['matricula_id'], ['matriculas.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('matricula_id', 'data', name='uq_matricula_excecao_data')
    )


def downgrade() -> None:
    op.drop_table('matricula_excecoes')
