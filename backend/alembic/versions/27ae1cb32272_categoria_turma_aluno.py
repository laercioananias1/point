"""categoria_turma_aluno

Revision ID: 27ae1cb32272
Revises: 2f6fd83fe533
Create Date: 2026-09-08 00:00:00.000000

Categoria (nível de aluno: Iniciante/Intermediário/Avançado etc.) cadastrada
por Point, com cor — pedido do usuário, 2026-09-08. Turma passa a ser
exclusiva de uma Categoria (categoria_id obrigatório). Toda Turma já
existente ganha uma categoria "Geral" (uma por Point) pra não quebrar dado
legado, seguindo o mesmo padrão de backfill+NOT NULL usado em
f4a1b6c7d802_email_obrigatorio.py. AlunoCategoria guarda o nível do aluno
POR Point (Aluno é entidade global, Categoria é por Point — não dá pra ter
um campo direto ambíguo em Aluno).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '27ae1cb32272'
down_revision: Union[str, None] = '2f6fd83fe533'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'categorias',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('nome', sa.String(60), nullable=False),
        sa.Column('cor', sa.String(7), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            onupdate=sa.text('now()'),
            nullable=False,
        ),
    )

    op.create_table(
        'aluno_categorias',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('aluno_id', sa.Integer(), sa.ForeignKey('alunos.id'), nullable=False),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('categoria_id', sa.Integer(), sa.ForeignKey('categorias.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            onupdate=sa.text('now()'),
            nullable=False,
        ),
        sa.UniqueConstraint('aluno_id', 'point_id', name='uq_aluno_categoria_point'),
    )

    op.add_column('turmas', sa.Column('categoria_id', sa.Integer(), sa.ForeignKey('categorias.id'), nullable=True))

    # Backfill: toda Turma já existente ganha uma categoria "Geral" própria
    # do Point dela (via vinculos.point_id), pra categoria_id poder virar
    # NOT NULL sem quebrar dado legado.
    op.execute(
        """
        INSERT INTO categorias (point_id, nome, cor, created_at, updated_at)
        SELECT DISTINCT v.point_id, 'Geral', '#9CA3AF', NOW(), NOW()
        FROM turmas t
        JOIN vinculos v ON v.id = t.vinculo_id
        """
    )
    op.execute(
        """
        UPDATE turmas t
        JOIN vinculos v ON v.id = t.vinculo_id
        JOIN categorias c ON c.point_id = v.point_id AND c.nome = 'Geral'
        SET t.categoria_id = c.id
        """
    )

    op.alter_column('turmas', 'categoria_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.drop_column('turmas', 'categoria_id')
    op.drop_table('aluno_categorias')
    op.drop_table('categorias')
