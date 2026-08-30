"""checkin_totalpass

Revision ID: af912952dc97
Revises: 03bb2fcdc24d
Create Date: 2026-08-26 01:21:18.961176

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'af912952dc97'
down_revision: Union[str, None] = '03bb2fcdc24d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # checkins estava totalmente sem uso até aqui (0 linhas) — pedido do
    # usuário, 2026-08-25: "aceitar os checkins" (TotalPass). turma_id
    # passa a ser obrigatório (check-in sem matrícula continua precisando
    # saber qual aula/quadra/Point foi).
    op.add_column('checkins', sa.Column('turma_id', sa.Integer(), nullable=False))
    op.add_column('checkins', sa.Column('beneficiario_nome', sa.String(length=160), nullable=True))
    op.add_column('checkins', sa.Column('beneficiario_documento', sa.String(length=32), nullable=True))
    op.create_foreign_key(None, 'checkins', 'turmas', ['turma_id'], ['id'])

    # Autogeração não pega mudança de valores de ENUM nativo do MySQL —
    # precisa alterar a coluna à mão pra incluir os novos valores.
    op.alter_column(
        'checkins',
        'origem',
        existing_type=sa.Enum('PRESUMIDO', name='checkinorigem'),
        type_=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', name='checkinorigem'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'checkins',
        'origem',
        existing_type=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', name='checkinorigem'),
        type_=sa.Enum('PRESUMIDO', name='checkinorigem'),
        existing_nullable=False,
    )
    op.drop_constraint(None, 'checkins', type_='foreignkey')
    op.drop_column('checkins', 'beneficiario_documento')
    op.drop_column('checkins', 'beneficiario_nome')
    op.drop_column('checkins', 'turma_id')
