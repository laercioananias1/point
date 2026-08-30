"""dias_horarios_funcionamento

Revision ID: d9e4f6a2b813
Revises: b7d3f2a91c40
Create Date: 2026-08-21 11:00:00.000000

Dias da semana e horários em que cada Point funciona (pedido do usuário,
2026-08-21) — limita o que o professor pode escolher ao criar turma. Nasce
com tudo liberado (todo dia, 5h-23h) pros Points já existentes, o admin
restringe depois se precisar.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9e4f6a2b813'
down_revision: Union[str, None] = 'b7d3f2a91c40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIAS_JSON = "(JSON_ARRAY('segunda','terça','quarta','quinta','sexta','sábado','domingo'))"
HORAS_JSON = "(JSON_ARRAY(" + ",".join(f"'{h:02d}:00'" for h in range(5, 24)) + "))"


def upgrade() -> None:
    op.add_column(
        'points',
        sa.Column(
            'dias_funcionamento', sa.JSON(), server_default=sa.text(DIAS_JSON), nullable=False
        ),
    )
    op.add_column(
        'points',
        sa.Column(
            'horarios_funcionamento', sa.JSON(), server_default=sa.text(HORAS_JSON), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column('points', 'horarios_funcionamento')
    op.drop_column('points', 'dias_funcionamento')
