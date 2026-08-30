"""matricula_dias_por_aluno

Revision ID: e7a4c9f215b6
Revises: d8f2c4b1a903
Create Date: 2026-08-21 18:00:00.000000

Muda o conceito central de matrícula mensal (pedido do usuário, 2026-08-21):
a Turma é a agenda inteira do professor (ex.: seg a sex, 8h) — cada aluno
usa um SUBCONJUNTO desses dias, não a turma inteira. Adiciona
matricula_dias_semana (dias que cada aluno frequenta dentro da turma) e
convite_dias_escolhidos (mesma ideia, mas no convite antes do aceite),
substituindo o M:N simples convite_turmas.

Sem dado real pra migrar agora — a base operacional (turmas, matrículas,
convites etc.) foi limpa nesta mesma leva, mantendo só as contas de login.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7a4c9f215b6'
down_revision: Union[str, None] = 'd8f2c4b1a903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('matricula_dias_semana',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('matricula_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['matricula_id'], ['matriculas.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('matricula_id', 'dia_semana', name='uq_matricula_dia_semana')
    )

    op.drop_table('convite_turmas')

    op.create_table('convite_dias_escolhidos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('convite_id', sa.Integer(), nullable=False),
    sa.Column('turma_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['convite_id'], ['convites.id'], ),
    sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('convite_id', 'turma_id', 'dia_semana', name='uq_convite_dia_escolhido')
    )


def downgrade() -> None:
    op.drop_table('convite_dias_escolhidos')

    op.create_table('convite_turmas',
    sa.Column('convite_id', sa.Integer(), nullable=False),
    sa.Column('turma_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['convite_id'], ['convites.id'], ),
    sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ),
    sa.PrimaryKeyConstraint('convite_id', 'turma_id'),
    )

    op.drop_table('matricula_dias_semana')
