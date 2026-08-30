"""preco_modalidade

Revision ID: c5b9d3e07a41
Revises: a3c8e1f92d67
Create Date: 2026-08-21 16:00:00.000000

Preço de aula avulsa/plano vira tabela do Point por modalidade, não mais
por vínculo (pedido do usuário, 2026-08-21: "esses valores são tabela do
point... com o professor só tem o acordo de repasse"). Modalidades já
existentes recebem 0.00 como placeholder — o admin ajusta depois em
PATCH /modalidades/{id}.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5b9d3e07a41'
down_revision: Union[str, None] = 'a3c8e1f92d67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'modalidades', sa.Column('preco_avulso', sa.Numeric(10, 2), server_default='0', nullable=False)
    )
    op.add_column(
        'modalidades', sa.Column('preco_plano', sa.Numeric(10, 2), server_default='0', nullable=False)
    )

    op.drop_column('vinculos', 'preco_avulso')
    op.drop_column('vinculos', 'preco_plano')
    op.drop_column('convites_vinculo', 'preco_avulso')
    op.drop_column('convites_vinculo', 'preco_plano')


def downgrade() -> None:
    op.add_column('convites_vinculo', sa.Column('preco_plano', sa.Numeric(10, 2), server_default='0', nullable=False))
    op.add_column('convites_vinculo', sa.Column('preco_avulso', sa.Numeric(10, 2), server_default='0', nullable=False))
    op.add_column('vinculos', sa.Column('preco_plano', sa.Numeric(10, 2), server_default='0', nullable=False))
    op.add_column('vinculos', sa.Column('preco_avulso', sa.Numeric(10, 2), server_default='0', nullable=False))

    op.drop_column('modalidades', 'preco_plano')
    op.drop_column('modalidades', 'preco_avulso')
