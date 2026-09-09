"""tipo_turma_privada

Revision ID: b270925c5d74
Revises: 11319c48e3f6
Create Date: 2026-09-09 00:00:00.000000

TipoTurma (pedido do usuário, 2026-09-09): cadastro por Point de
tipo/formato de turma — 'Padrão', 'Aula particular', 'Dupla', 'Família'.
Turma ganha tipo_turma_id (obrigatório, com backfill de um tipo 'Padrão'
por Point pra não quebrar turma existente) e privada (bool, independente
do tipo — "o ser privado ou não tem que ser na turma e não no tipo").
Mesmo padrão de backfill já usado em 27ae1cb32272_categoria_turma_aluno.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b270925c5d74'
down_revision: Union[str, None] = '11319c48e3f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tipos_turma',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('point_id', sa.Integer(), sa.ForeignKey('points.id'), nullable=False),
        sa.Column('nome', sa.String(60), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            onupdate=sa.text('now()'),
            nullable=False,
        ),
    )

    op.add_column('turmas', sa.Column('tipo_turma_id', sa.Integer(), sa.ForeignKey('tipos_turma.id'), nullable=True))
    op.add_column(
        'turmas',
        sa.Column('privada', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Backfill: toda Turma já existente ganha um tipo "Padrão" próprio do
    # Point dela (via vinculos.point_id), pra tipo_turma_id poder virar
    # NOT NULL sem quebrar dado legado.
    op.execute(
        """
        INSERT INTO tipos_turma (point_id, nome, created_at, updated_at)
        SELECT DISTINCT v.point_id, 'Padrão', NOW(), NOW()
        FROM turmas t
        JOIN vinculos v ON v.id = t.vinculo_id
        """
    )
    op.execute(
        """
        UPDATE turmas t
        JOIN vinculos v ON v.id = t.vinculo_id
        JOIN tipos_turma tt ON tt.point_id = v.point_id AND tt.nome = 'Padrão'
        SET t.tipo_turma_id = tt.id
        """
    )

    op.alter_column('turmas', 'tipo_turma_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.drop_column('turmas', 'privada')
    op.drop_column('turmas', 'tipo_turma_id')
    op.drop_table('tipos_turma')
