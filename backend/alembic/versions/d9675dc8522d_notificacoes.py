"""notificacoes

Revision ID: d9675dc8522d
Revises: ac46fa2d460a
Create Date: 2026-09-11 00:00:00.000002

Notificações dentro do próprio app (pedido do usuário, 2026-09-11: "esse
tipo de msg é bom tb ter no app... já tava previsto lá no início fazermos
uma tela de notificações") — começa só com cancelamento de aula
(routers/turmas.py::remover_turma), tabela genérica pra outros eventos
reaproveitarem depois.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9675dc8522d'
down_revision: Union[str, None] = 'ac46fa2d460a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notificacoes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column(
            'tipo',
            sa.Enum('CANCELAMENTO_AULA', name='notificacaotipo'),
            nullable=False,
        ),
        sa.Column('titulo', sa.String(length=120), nullable=False),
        sa.Column('mensagem', sa.String(length=500), nullable=False),
        sa.Column('lida', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notificacoes_user_id'), 'notificacoes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notificacoes_user_id'), table_name='notificacoes')
    op.drop_table('notificacoes')
