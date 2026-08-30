"""funcionamento_semana_fds

Revision ID: e2f5a8c9d104
Revises: d9e4f6a2b813
Create Date: 2026-08-21 12:00:00.000000

Separa dias/horários de funcionamento do Point em dois grupos — dias úteis
e fim de semana (pedido do usuário, 2026-08-21: sábado costuma ter só
parte da manhã, bem diferente do horário de semana). Substitui as colunas
únicas criadas na migration anterior; o recurso acabou de nascer e ainda
não tinha uso real, então não precisa preservar valor migrado.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2f5a8c9d104'
down_revision: Union[str, None] = 'd9e4f6a2b813'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIAS_UTEIS_JSON = "(JSON_ARRAY('segunda','terça','quarta','quinta','sexta'))"
DIAS_FDS_JSON = "(JSON_ARRAY('sábado','domingo'))"
HORAS_JSON = "(JSON_ARRAY(" + ",".join(f"'{h:02d}:00'" for h in range(5, 24)) + "))"


def upgrade() -> None:
    op.drop_column('points', 'horarios_funcionamento')
    op.drop_column('points', 'dias_funcionamento')

    op.add_column(
        'points',
        sa.Column(
            'dias_semana_funcionamento', sa.JSON(), server_default=sa.text(DIAS_UTEIS_JSON),
            nullable=False,
        ),
    )
    op.add_column(
        'points',
        sa.Column(
            'horarios_semana_funcionamento', sa.JSON(), server_default=sa.text(HORAS_JSON),
            nullable=False,
        ),
    )
    op.add_column(
        'points',
        sa.Column(
            'dias_fds_funcionamento', sa.JSON(), server_default=sa.text(DIAS_FDS_JSON),
            nullable=False,
        ),
    )
    op.add_column(
        'points',
        sa.Column(
            'horarios_fds_funcionamento', sa.JSON(), server_default=sa.text(HORAS_JSON),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('points', 'horarios_fds_funcionamento')
    op.drop_column('points', 'dias_fds_funcionamento')
    op.drop_column('points', 'horarios_semana_funcionamento')
    op.drop_column('points', 'dias_semana_funcionamento')

    op.add_column(
        'points',
        sa.Column(
            'dias_funcionamento', sa.JSON(),
            server_default=sa.text(
                "(JSON_ARRAY('segunda','terça','quarta','quinta','sexta','sábado','domingo'))"
            ),
            nullable=False,
        ),
    )
    op.add_column(
        'points',
        sa.Column('horarios_funcionamento', sa.JSON(), server_default=sa.text(HORAS_JSON), nullable=False),
    )
