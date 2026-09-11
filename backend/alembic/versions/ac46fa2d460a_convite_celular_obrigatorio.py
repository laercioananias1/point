"""convite_celular_obrigatorio

Revision ID: ac46fa2d460a
Revises: 3258ee932c47
Create Date: 2026-09-11 00:00:00.000001

Celular do convite de aluno vira OBRIGATÓRIO (pedido do usuário,
2026-09-11: "convidar aluno nao é mais opcional o celular, devido agora
comecar utilizar whats precisa") — tinha voltado opcional só um instante
antes (3258ee932c47), mas o WhatsApp passou a ser parte do fluxo de
convite desde já, então não faz sentido deixar sem número. Convites
antigos que ficaram com celular NULL (criados na janela em que era
opcional) recebem uma string vazia no backfill — só pra satisfazer a
constraint; não têm mais como ser reenviados por WhatsApp de qualquer
forma (convite expira em 7 dias).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ac46fa2d460a'
down_revision: Union[str, None] = '3258ee932c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE convites SET celular = '' WHERE celular IS NULL")
    op.alter_column('convites', 'celular', existing_type=sa.String(30), nullable=False)


def downgrade() -> None:
    op.alter_column('convites', 'celular', existing_type=sa.String(30), nullable=True)
