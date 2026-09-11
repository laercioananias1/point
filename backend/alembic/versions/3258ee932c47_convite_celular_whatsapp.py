"""convite_celular_whatsapp

Revision ID: 3258ee932c47
Revises: bdfe68626482
Create Date: 2026-09-11 00:00:00.000000

Convite de aluno ganha celular de volta, opcional (pedido do usuário,
2026-09-11: "volta o campo celular no convite de aluno" — só pra poder
mandar o convite por WhatsApp também; sem relação com o celular que o
aceite pede de novo, ConviteAceitarNovo). Professor e admin já tinham
celular desde sempre, não precisam de migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3258ee932c47'
down_revision: Union[str, None] = 'bdfe68626482'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('convites', sa.Column('celular', sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column('convites', 'celular')
