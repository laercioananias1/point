"""notificacao_tipo_experimental

Revision ID: 9001502b256f
Revises: 2f827031670e
Create Date: 2026-09-14 00:00:01.000000

notificacoes.tipo só aceitava 'CANCELAMENTO_AULA' — o enum MySQL da coluna
precisa listar TODO valor de NotificacaoTipo, senão trunca (pymysql
DataError 1265) na hora de gravar o novo tipo 'SOLICITACAO_EXPERIMENTAL'
(pedido do usuário, 2026-09-14, ver routers/experimental.py). Achado
rodando o teste real do fluxo, antes de chegar em produção.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9001502b256f'
down_revision: Union[str, None] = '2f827031670e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'notificacoes',
        'tipo',
        existing_type=sa.Enum('CANCELAMENTO_AULA', name='notificacaotipo'),
        type_=sa.Enum('CANCELAMENTO_AULA', 'SOLICITACAO_EXPERIMENTAL', name='notificacaotipo'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'notificacoes',
        'tipo',
        existing_type=sa.Enum('CANCELAMENTO_AULA', 'SOLICITACAO_EXPERIMENTAL', name='notificacaotipo'),
        type_=sa.Enum('CANCELAMENTO_AULA', name='notificacaotipo'),
        existing_nullable=False,
    )
