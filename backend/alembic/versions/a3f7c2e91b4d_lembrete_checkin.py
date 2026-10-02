"""lembrete automático de check-in por Point

Pedido do usuário, 2026-10-02: o site promete que o aluno com saldo de
check-ins negativo recebe lembrete no WhatsApp. Liga/desliga por Point,
desligado por padrão.

Revision ID: a3f7c2e91b4d
Revises: e8c4a1d6b902
Create Date: 2026-10-02
"""

import sqlalchemy as sa
from alembic import op

revision = "a3f7c2e91b4d"
down_revision = "e8c4a1d6b902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "points",
        sa.Column("lembrete_checkin", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("points", "lembrete_checkin")
