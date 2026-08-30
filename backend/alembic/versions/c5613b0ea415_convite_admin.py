"""convite_admin

Revision ID: c5613b0ea415
Revises: 2c261618e40d
Create Date: 2026-08-26 21:00:00.000000

Convite de admin do Point por link/e-mail (pedido do usuário, 2026-08-26:
"não quero criar senha de admin, faça o mesmo padrão de aluno e
professor") — mesmo padrão de convites/convites_vinculo, substituindo o
antigo POST /points/{id}/admins que criava a conta já com senha definida
pelo dono do app.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5613b0ea415'
down_revision: Union[str, None] = '2c261618e40d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'convites_admin',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('point_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('celular', sa.String(length=20), nullable=False),
        sa.Column('email', sa.String(length=160), nullable=False),
        sa.Column(
            'status',
            sa.Enum('PENDENTE', 'ACEITO', 'CANCELADO', name='convitestatus'),
            nullable=False,
        ),
        sa.Column('expira_em', sa.Date(), nullable=False),
        sa.Column('aceito_em', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['point_id'], ['points.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_convites_admin_token'), 'convites_admin', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_convites_admin_token'), table_name='convites_admin')
    op.drop_table('convites_admin')
