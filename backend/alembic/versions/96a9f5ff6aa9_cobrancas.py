"""cobrancas

Revision ID: 96a9f5ff6aa9
Revises: 830291a2bccf
Create Date: 2026-09-20 00:00:00.000000

Tela de Cobranças do financeiro (pedido do usuário, 2026-09-20) —
cobrança avulsa por aluno + mensalidade gerada das assinaturas ativas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '96a9f5ff6aa9'
down_revision: Union[str, None] = '830291a2bccf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cobrancas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('aluno_id', sa.Integer(), sa.ForeignKey('alunos.id'), nullable=False),
        sa.Column('assinatura_id', sa.Integer(), sa.ForeignKey('assinaturas.id'), nullable=True),
        sa.Column('descricao', sa.String(120), nullable=False),
        sa.Column('valor', sa.Numeric(10, 2), nullable=False),
        sa.Column('vencimento', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('ABERTA', 'PAGA', name='cobrancastatus'), nullable=False),
        sa.Column('pago_em', sa.Date(), nullable=True),
        sa.Column('mes_referencia', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('assinatura_id', 'mes_referencia'),
    )
    op.create_index('ix_cobrancas_point_id', 'cobrancas', ['point_id'])
    op.create_index('ix_cobrancas_aluno_id', 'cobrancas', ['aluno_id'])


def downgrade() -> None:
    op.drop_index('ix_cobrancas_aluno_id', table_name='cobrancas')
    op.drop_index('ix_cobrancas_point_id', table_name='cobrancas')
    op.drop_table('cobrancas')
