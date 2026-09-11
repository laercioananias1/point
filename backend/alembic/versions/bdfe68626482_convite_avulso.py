"""convite_avulso

Revision ID: bdfe68626482
Revises: b270925c5d74
Create Date: 2026-09-11 00:00:00.000000

Convite ganha modo avulso (pedido do usuário, 2026-09-11: "pode ser um
aluno avulso... abre opção se for avulso não preenche plano, data início,
forma de pagto, turma, nada disso") — convite só cria a conta, sem
Assinatura. Os 5 campos que hoje formam a assinatura pré-configurada
(modalidade_id, periodo_dia_desejado, fonte_pagamento, plano_id,
data_inicio) viram opcionais; convite existente continua com avulso=False
e todos preenchidos (backfill automático, não precisa de UPDATE — coluna
nova nasce com default). Aluno.forma_pagamento_preferida também vira
opcional, pro aceite avulso não precisar inventar um valor.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'bdfe68626482'
down_revision: Union[str, None] = 'b270925c5d74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PAGAMENTO_MEIO = sa.Enum('PIX', 'DINHEIRO', 'WELLHUB', 'TOTALPASS', name='pagamentomeio')
_FORMA_PAGAMENTO = sa.Enum('PIX', 'DINHEIRO', 'WELLHUB', 'TOTALPASS', name='formapagamento')
_PERIODO_DIA = sa.Enum('MANHA', 'TARDE', 'NOITE', name='periododia')


def upgrade() -> None:
    op.add_column('convites', sa.Column('avulso', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.alter_column('convites', 'modalidade_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('convites', 'plano_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('convites', 'data_inicio', existing_type=sa.Date(), nullable=True)
    op.alter_column('convites', 'periodo_dia_desejado', existing_type=_PERIODO_DIA, nullable=True)
    op.alter_column('convites', 'fonte_pagamento', existing_type=_PAGAMENTO_MEIO, nullable=True)

    op.alter_column('alunos', 'forma_pagamento_preferida', existing_type=_FORMA_PAGAMENTO, nullable=True)


def downgrade() -> None:
    # Downgrade assume que nenhum convite avulso (nem aluno sem forma de
    # pagamento) foi criado ainda — se já tiver, o ALTER abaixo falha
    # (esperado: não dá pra voltar um NULL pra NOT NULL sem inventar valor).
    op.alter_column('alunos', 'forma_pagamento_preferida', existing_type=_FORMA_PAGAMENTO, nullable=False)

    op.alter_column('convites', 'fonte_pagamento', existing_type=_PAGAMENTO_MEIO, nullable=False)
    op.alter_column('convites', 'periodo_dia_desejado', existing_type=_PERIODO_DIA, nullable=False)
    op.alter_column('convites', 'data_inicio', existing_type=sa.Date(), nullable=False)
    op.alter_column('convites', 'plano_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('convites', 'modalidade_id', existing_type=sa.Integer(), nullable=False)

    op.drop_column('convites', 'avulso')
