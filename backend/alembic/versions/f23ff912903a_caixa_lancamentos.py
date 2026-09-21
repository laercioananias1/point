"""caixa_lancamentos

Revision ID: f23ff912903a
Revises: 96a9f5ff6aa9
Create Date: 2026-09-20 00:00:00.000000

Caixa do Point (pedido do usuário, 2026-09-20: "Caixa, onde tem entradas e
saídas") — contas, lançamentos fixos (repetem todo mês) e lançamentos.
Backfill: cada Pagamento já confirmado vira uma entrada, exceto os que
foram gravados por uma Cobrança paga (esses entram pela própria cobrança,
senão a mesma mensalidade contaria duas vezes).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f23ff912903a'
down_revision: Union[str, None] = '96a9f5ff6aa9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        'contas_caixa',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('nome', sa.String(60), nullable=False),
        *_timestamps(),
    )
    op.create_index('ix_contas_caixa_point_id', 'contas_caixa', ['point_id'])

    op.create_table(
        'lancamentos_fixos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('tipo', sa.Enum('ENTRADA', 'SAIDA', name='lancamentotipo'), nullable=False),
        sa.Column('descricao', sa.String(120), nullable=False),
        sa.Column('valor', sa.Numeric(10, 2), nullable=False),
        sa.Column('dia', sa.Integer(), nullable=False),
        sa.Column('conta_id', sa.Integer(), sa.ForeignKey('contas_caixa.id'), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
    )
    op.create_index('ix_lancamentos_fixos_point_id', 'lancamentos_fixos', ['point_id'])

    op.create_table(
        'lancamentos_caixa',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('tipo', sa.Enum('ENTRADA', 'SAIDA', name='lancamentotipo'), nullable=False),
        sa.Column('descricao', sa.String(120), nullable=False),
        sa.Column('valor', sa.Numeric(10, 2), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('conta_id', sa.Integer(), sa.ForeignKey('contas_caixa.id'), nullable=True),
        sa.Column('origem_cobranca_id', sa.Integer(), sa.ForeignKey('cobrancas.id'), nullable=True),
        sa.Column('origem_pagamento_id', sa.Integer(), sa.ForeignKey('pagamentos.id'), nullable=True),
        sa.Column('fixo_id', sa.Integer(), sa.ForeignKey('lancamentos_fixos.id'), nullable=True),
        sa.Column('mes_referencia', sa.Date(), nullable=True),
        *_timestamps(),
        sa.UniqueConstraint('origem_cobranca_id'),
        sa.UniqueConstraint('origem_pagamento_id'),
        sa.UniqueConstraint('fixo_id', 'mes_referencia'),
    )
    op.create_index('ix_lancamentos_caixa_point_id', 'lancamentos_caixa', ['point_id'])
    op.create_index('ix_lancamentos_caixa_data', 'lancamentos_caixa', ['data'])

    op.execute(
        """
        INSERT INTO lancamentos_caixa
            (point_id, tipo, descricao, valor, data, origem_pagamento_id, created_at, updated_at)
        SELECT
            v.point_id,
            'ENTRADA',
            LEFT(CONCAT(IF(p.mes_referencia IS NULL, 'Pagamento', 'Mensalidade'), ' — ', a.nome), 120),
            p.valor,
            DATE(p.updated_at),
            p.id,
            NOW(),
            NOW()
        FROM pagamentos p
        JOIN matriculas m ON m.id = p.matricula_id
        JOIN turmas t ON t.id = m.turma_id
        JOIN vinculos v ON v.id = t.vinculo_id
        JOIN alunos a ON a.id = m.aluno_id
        WHERE p.status = 'CONFIRMADO'
          AND NOT EXISTS (
              SELECT 1 FROM cobrancas c
              WHERE c.assinatura_id = m.assinatura_id
                AND c.mes_referencia = p.mes_referencia
                AND c.status = 'PAGA'
          )
        """
    )


def downgrade() -> None:
    op.drop_index('ix_lancamentos_caixa_data', table_name='lancamentos_caixa')
    op.drop_index('ix_lancamentos_caixa_point_id', table_name='lancamentos_caixa')
    op.drop_table('lancamentos_caixa')
    op.drop_index('ix_lancamentos_fixos_point_id', table_name='lancamentos_fixos')
    op.drop_table('lancamentos_fixos')
    op.drop_index('ix_contas_caixa_point_id', table_name='contas_caixa')
    op.drop_table('contas_caixa')
