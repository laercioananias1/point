"""wellhub_checkins

Revision ID: 1a409560c50a
Revises: 70c983500188
Create Date: 2026-09-29 00:00:00.000000

Log de check-ins Wellhub (pedido do usuário, 2026-09-29: "vincular sempre
um checkin com uma aula vai ficar complicado... trabalhar com saldos de
checkin e qtde aulas feitas") — tabela solta por Point+gympass_id+dia, sem
turma_id, mais o Gympass ID opcional em Aluno pra ligar os dois.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1a409560c50a'
down_revision: Union[str, None] = '70c983500188'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('alunos', sa.Column('wellhub_gympass_id', sa.String(20), nullable=True))
    op.create_unique_constraint('uq_alunos_wellhub_gympass_id', 'alunos', ['wellhub_gympass_id'])

    op.create_table(
        'wellhub_checkins',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('gympass_id', sa.String(20), nullable=False),
        sa.Column('aluno_id', sa.Integer(), sa.ForeignKey('alunos.id'), nullable=True),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('nome_wellhub', sa.String(160), nullable=True),
        sa.Column('origem', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('point_id', 'gympass_id', 'data'),
    )
    op.create_index('ix_wellhub_checkins_point_id', 'wellhub_checkins', ['point_id'])
    op.create_index('ix_wellhub_checkins_gympass_id', 'wellhub_checkins', ['gympass_id'])
    op.create_index('ix_wellhub_checkins_data', 'wellhub_checkins', ['data'])


def downgrade() -> None:
    op.drop_index('ix_wellhub_checkins_data', table_name='wellhub_checkins')
    op.drop_index('ix_wellhub_checkins_gympass_id', table_name='wellhub_checkins')
    op.drop_index('ix_wellhub_checkins_point_id', table_name='wellhub_checkins')
    op.drop_table('wellhub_checkins')

    op.drop_constraint('uq_alunos_wellhub_gympass_id', 'alunos', type_='unique')
    op.drop_column('alunos', 'wellhub_gympass_id')
