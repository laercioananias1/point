"""checkin_experimental

Revision ID: 830291a2bccf
Revises: b345b3769b69
Create Date: 2026-09-15 00:00:00.000000

Presença de visitante de aula experimental (pedido do usuário,
2026-09-15: "na realidade o experimental é quase um aluno, ele só não
tem uma senha para entrar") — Checkin ganha solicitacao_experimental_id
(mesmo espírito de matricula_id, pra quem não tem matrícula nenhuma) e
o enum de origem ganha 'EXPERIMENTAL'.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '830291a2bccf'
down_revision: Union[str, None] = 'b345b3769b69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'checkins', sa.Column('solicitacao_experimental_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_checkins_solicitacao_experimental_id',
        'checkins',
        'solicitacoes_experimentais',
        ['solicitacao_experimental_id'],
        ['id'],
    )
    op.alter_column(
        'checkins',
        'origem',
        existing_type=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', name='checkinorigem'),
        type_=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', 'EXPERIMENTAL', name='checkinorigem'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'checkins',
        'origem',
        existing_type=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', 'EXPERIMENTAL', name='checkinorigem'),
        type_=sa.Enum('PRESUMIDO', 'TOTALPASS', 'WELLHUB', name='checkinorigem'),
        existing_nullable=False,
    )
    op.drop_constraint('fk_checkins_solicitacao_experimental_id', 'checkins', type_='foreignkey')
    op.drop_column('checkins', 'solicitacao_experimental_id')
