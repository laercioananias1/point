"""turma_multi_dia

Revision ID: d4f8a1c92b7e
Revises: 3576534cddbc
Create Date: 2026-08-20 15:40:00.000000

Turma passa a cobrir vários dias da semana (pedido do usuário, 2026-08-20:
"a turma não deveria ser uma pra n dias?") em vez de 1 turma por dia. Move
`turmas.dia_semana` pra uma tabela filha `turma_dias_semana`, migrando os
dados existentes antes de derrubar a coluna.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4f8a1c92b7e'
down_revision: Union[str, None] = '3576534cddbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('turma_dias_semana',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('turma_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('turma_id', 'dia_semana', name='uq_turma_dia_semana')
    )

    # Cada Turma existente tinha exatamente 1 dia — vira 1 linha aqui.
    op.execute(
        "INSERT INTO turma_dias_semana (turma_id, dia_semana, created_at, updated_at) "
        "SELECT id, dia_semana, NOW(), NOW() FROM turmas"
    )

    op.drop_column('turmas', 'dia_semana')


def downgrade() -> None:
    op.add_column('turmas', sa.Column('dia_semana', sa.String(length=20), nullable=True))

    # Downgrade só recupera 1 dia por turma (o menor alfabeticamente) — uma
    # Turma que passou a cobrir vários dias no modelo novo não tem como
    # voltar fielmente pro modelo antigo de 1 dia por turma.
    op.execute(
        "UPDATE turmas t SET dia_semana = ("
        "  SELECT MIN(dia_semana) FROM turma_dias_semana WHERE turma_id = t.id"
        ")"
    )
    op.alter_column('turmas', 'dia_semana', nullable=False)

    op.drop_table('turma_dias_semana')
