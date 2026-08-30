"""convites_vinculo

Revision ID: a3c8e1f92d67
Revises: f4a1b6c7d802
Create Date: 2026-08-21 15:00:00.000000

Convite de vínculo (pedido do usuário, 2026-08-21) — o professor não
solicita mais vínculo; o admin do Point convida com as condições
comerciais já decididas, mesmo padrão do convite de assinatura do aluno.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c8e1f92d67'
down_revision: Union[str, None] = 'f4a1b6c7d802'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('convites_vinculo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('token', sa.String(length=64), nullable=False),
    sa.Column('point_id', sa.Integer(), nullable=False),
    sa.Column('nome', sa.String(length=120), nullable=False),
    sa.Column('celular', sa.String(length=20), nullable=False),
    sa.Column('email', sa.String(length=160), nullable=False),
    sa.Column('preco_avulso', sa.Numeric(10, 2), nullable=False),
    sa.Column('preco_plano', sa.Numeric(10, 2), nullable=False),
    sa.Column('modelo_repasse', sa.Enum('PERCENTUAL', 'VALOR_FIXO_MENSAL', 'VALOR_FIXO_POR_AULA', name='modelorepasse'), nullable=False),
    sa.Column('valor_repasse', sa.Numeric(10, 2), nullable=False),
    sa.Column('status', sa.Enum('PENDENTE', 'ACEITO', 'CANCELADO', name='convitestatus'), nullable=False),
    sa.Column('expira_em', sa.Date(), nullable=False),
    sa.Column('aceito_em', sa.DateTime(), nullable=True),
    sa.Column('vinculo_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['point_id'], ['points.id'], ),
    sa.ForeignKeyConstraint(['vinculo_id'], ['vinculos.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token'),
    )
    op.create_index(op.f('ix_convites_vinculo_token'), 'convites_vinculo', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_convites_vinculo_token'), table_name='convites_vinculo')
    op.drop_table('convites_vinculo')
