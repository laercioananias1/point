"""convite_sem_celular

Revision ID: 89501d9d5c60
Revises: af912952dc97
Create Date: 2026-08-26 15:43:54.421498

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = '89501d9d5c60'
down_revision: Union[str, None] = 'af912952dc97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pedido do usuário, 2026-08-26: "tira desse cadastro celular" — quem
    # informa o próprio celular agora é o aluno, ao aceitar o convite
    # (ConviteAceitarNovo), não mais o admin na hora de convidar.
    op.drop_column('convites', 'celular')


def downgrade() -> None:
    op.add_column('convites', sa.Column('celular', mysql.VARCHAR(length=20), nullable=False))
