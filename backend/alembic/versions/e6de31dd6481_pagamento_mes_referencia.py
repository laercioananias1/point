"""pagamento_mes_referencia

Revision ID: e6de31dd6481
Revises: e7a4c9f215b6
Create Date: 2026-08-21 20:00:00.000000

Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21): antes um
único Pagamento CONFIRMADO deixava a matrícula mensal "paga" pra sempre. Agora
cada Pagamento de matrícula mensal cobre um mês específico
(mes_referencia, sempre o dia 1 do mês) — o aluno precisa pagar de novo todo
mês. Matrícula avulsa continua com mes_referencia nulo (pagamento único, sem
mês associado).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e6de31dd6481'
down_revision: Union[str, None] = 'e7a4c9f215b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pagamentos', sa.Column('mes_referencia', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('pagamentos', 'mes_referencia')
