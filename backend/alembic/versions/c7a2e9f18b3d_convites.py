"""convites

Revision ID: c7a2e9f18b3d
Revises: d4f8a1c92b7e
Create Date: 2026-08-20 18:00:00.000000

Convite de assinatura (pedido do usuário, 2026-08-20): o admin decide a
assinatura inteira e manda um convite por e-mail; o aluno cadastra a
própria conta (ou só aceita, se já tiver uma) e ela ativa sozinha.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7a2e9f18b3d'
down_revision: Union[str, None] = 'd4f8a1c92b7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('convites',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('token', sa.String(length=64), nullable=False),
    sa.Column('point_id', sa.Integer(), nullable=False),
    sa.Column('nome', sa.String(length=120), nullable=False),
    sa.Column('celular', sa.String(length=20), nullable=False),
    sa.Column('email', sa.String(length=160), nullable=False),
    sa.Column('modalidade_id', sa.Integer(), nullable=False),
    sa.Column('periodo_dia_desejado', sa.Enum('MANHA', 'TARDE', 'NOITE', name='periododia'), nullable=False),
    sa.Column('fonte_pagamento', sa.Enum('PIX', 'DINHEIRO', name='pagamentomeio'), nullable=False),
    sa.Column('plano_id', sa.Integer(), nullable=False),
    sa.Column('data_inicio', sa.Date(), nullable=False),
    sa.Column('status', sa.Enum('PENDENTE', 'ACEITO', 'CANCELADO', name='convitestatus'), nullable=False),
    sa.Column('expira_em', sa.Date(), nullable=False),
    sa.Column('aceito_em', sa.DateTime(), nullable=True),
    sa.Column('assinatura_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['point_id'], ['points.id'], ),
    sa.ForeignKeyConstraint(['modalidade_id'], ['modalidades.id'], ),
    sa.ForeignKeyConstraint(['plano_id'], ['planos.id'], ),
    sa.ForeignKeyConstraint(['assinatura_id'], ['assinaturas.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token'),
    )
    op.create_index(op.f('ix_convites_token'), 'convites', ['token'], unique=True)

    op.create_table('convite_turmas',
    sa.Column('convite_id', sa.Integer(), nullable=False),
    sa.Column('turma_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['convite_id'], ['convites.id'], ),
    sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ),
    sa.PrimaryKeyConstraint('convite_id', 'turma_id'),
    )


def downgrade() -> None:
    op.drop_table('convite_turmas')
    op.drop_index(op.f('ix_convites_token'), table_name='convites')
    op.drop_table('convites')
