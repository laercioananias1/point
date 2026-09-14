"""aula_experimental

Revision ID: 2f827031670e
Revises: d9675dc8522d
Create Date: 2026-09-14 00:00:00.000000

Programa de aula experimental (pedido do usuário, 2026-09-14: "criar uma
pagina publica, sem login, para qualquer pessoa poder solicitar uma aula
experimental"). Turma.aula_experimental decide se ela participa
('aceita' compartilha a mesma capacidade com matrícula normal; 'somente'
é dedicada só a isso — ver ExperimentalConfig.__doc__). Toda turma
existente vira 'NAO' no backfill (nenhuma participava antes disso
existir). solicitacoes_experimentais guarda os pedidos feitos pela
página pública, sem login nenhum por trás — só os dados de contato que o
próprio visitante informou.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2f827031670e'
down_revision: Union[str, None] = 'd9675dc8522d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'turmas',
        sa.Column(
            'aula_experimental',
            sa.Enum('NAO', 'ACEITA', 'SOMENTE', name='experimentalconfig'),
            nullable=False,
            server_default='NAO',
        ),
    )

    op.create_table(
        'solicitacoes_experimentais',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('turma_id', sa.Integer(), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('celular', sa.String(length=30), nullable=False),
        sa.Column('tem_raquete', sa.Boolean(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('PENDENTE', 'APROVADA', 'RECUSADA', name='solicitacaoexperimentalstatus'),
            nullable=False,
            server_default='PENDENTE',
        ),
        sa.Column('decidido_por_id', sa.Integer(), nullable=True),
        sa.Column('decidido_em', sa.DateTime(), nullable=True),
        sa.Column('motivo_recusa', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['turma_id'], ['turmas.id']),
        sa.ForeignKeyConstraint(['decidido_por_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_solicitacoes_experimentais_turma_id'),
        'solicitacoes_experimentais',
        ['turma_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_solicitacoes_experimentais_turma_id'), table_name='solicitacoes_experimentais')
    op.drop_table('solicitacoes_experimentais')
    op.drop_column('turmas', 'aula_experimental')
