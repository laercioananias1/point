"""matricula_data_avulsa

Revision ID: 03bb2fcdc24d
Revises: c5613b0ea415
Create Date: 2026-08-25 21:16:31.790317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '03bb2fcdc24d'
down_revision: Union[str, None] = 'c5613b0ea415'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Data específica escolhida pelo aluno pra matrícula AVULSA (pedido do
    # usuário, 2026-08-25 — reposição de crédito precisa deixar o aluno
    # escolher dia/horário no calendário). Nula pra matrícula mensal e pra
    # avulsa antiga (cai no fallback de turma.periodo_inicio).
    #
    # A autogeração do Alembic também detectou 'token' index drops em
    # convites/convites_vinculo — drift antigo, sem relação com esta
    # mudança; removido daqui de propósito pra não misturar.
    op.add_column('matriculas', sa.Column('data_avulsa', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('matriculas', 'data_avulsa')
