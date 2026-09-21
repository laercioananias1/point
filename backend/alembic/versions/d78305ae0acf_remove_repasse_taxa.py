"""remove_repasse_taxa

Revision ID: d78305ae0acf
Revises: f23ff912903a
Create Date: 2026-09-20 00:00:00.000000

Repasse a professor e taxa de serviço saem do sistema (pedido do usuário,
2026-09-20: "ainda está em desenvolvimento, não tem ninguém usando em
produção, pode apagar de vez"). Apaga fechamentos, repasses de fechamento e
a configuração da plataforma (que só guardava a taxa), e as colunas de
repasse de vínculos, convites de vínculo e matrículas.

Destrutivo: o downgrade só recria a ESTRUTURA (colunas com valor padrão),
não os dados apagados.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd78305ae0acf'
down_revision: Union[str, None] = 'f23ff912903a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MODELO_REPASSE = sa.Enum('PERCENTUAL', 'VALOR_FIXO_MENSAL', 'VALOR_FIXO_POR_AULA', name='modelorepasse')


def upgrade() -> None:
    op.drop_table('repasses_fechamento')
    op.drop_table('fechamentos')
    op.drop_table('configuracao_plataforma')

    op.drop_column('vinculos', 'modelo_repasse')
    op.drop_column('vinculos', 'valor_repasse')
    op.drop_column('convites_vinculo', 'modelo_repasse')
    op.drop_column('convites_vinculo', 'valor_repasse')
    op.drop_column('matriculas', 'repasse_override_modelo')
    op.drop_column('matriculas', 'repasse_override_valor')


def downgrade() -> None:
    op.add_column(
        'matriculas', sa.Column('repasse_override_valor', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('matriculas', sa.Column('repasse_override_modelo', MODELO_REPASSE, nullable=True))
    op.add_column(
        'convites_vinculo',
        sa.Column('valor_repasse', sa.Numeric(10, 2), nullable=False, server_default='0'),
    )
    op.add_column(
        'convites_vinculo',
        sa.Column('modelo_repasse', MODELO_REPASSE, nullable=False, server_default='PERCENTUAL'),
    )
    op.add_column(
        'vinculos',
        sa.Column('valor_repasse', sa.Numeric(10, 2), nullable=False, server_default='0'),
    )
    op.add_column(
        'vinculos',
        sa.Column('modelo_repasse', MODELO_REPASSE, nullable=False, server_default='PERCENTUAL'),
    )

    op.create_table(
        'configuracao_plataforma',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('taxa_servico', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )
    op.create_table(
        'fechamentos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('periodo_inicio', sa.Date(), nullable=False),
        sa.Column('periodo_fim', sa.Date(), nullable=False),
        sa.Column('taxa_servico_unitaria', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantidade_pagamentos', sa.Integer(), nullable=False),
        sa.Column('total_taxa_servico', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )
    op.create_table(
        'repasses_fechamento',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fechamento_id', sa.Integer(), sa.ForeignKey('fechamentos.id'), nullable=False),
        sa.Column('professor_id', sa.Integer(), sa.ForeignKey('professores.id'), nullable=False),
        sa.Column('valor', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )
