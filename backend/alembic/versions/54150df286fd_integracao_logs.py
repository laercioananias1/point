"""integracao_logs

Revision ID: 54150df286fd
Revises: 1a409560c50a
Create Date: 2026-09-29 00:00:00.000000

Log de toda chamada a integração externa (pedido do usuário, 2026-09-29:
"gostaria de ter uma tela de logs de integrações, assim fico sabendo se
tá dando erro ou não") — WhatsApp, e-mail, Wellhub, TotalPass.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '54150df286fd'
down_revision: Union[str, None] = '1a409560c50a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'integracao_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('integracao', sa.String(20), nullable=False),
        sa.Column('evento', sa.String(120), nullable=False),
        sa.Column('destino', sa.String(160), nullable=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=True),
        sa.Column('sucesso', sa.Boolean(), nullable=False),
        sa.Column('mensagem', sa.String(500), nullable=False),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_integracao_logs_integracao', 'integracao_logs', ['integracao'])
    op.create_index('ix_integracao_logs_criado_em', 'integracao_logs', ['criado_em'])


def downgrade() -> None:
    op.drop_index('ix_integracao_logs_criado_em', table_name='integracao_logs')
    op.drop_index('ix_integracao_logs_integracao', table_name='integracao_logs')
    op.drop_table('integracao_logs')
