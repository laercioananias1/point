"""wellhub_checkins vira registro de check-in de qualquer plataforma

Pedido do usuário, 2026-09-30: "totalpass vai funcionar do mesmo jeito
que wellhub... trata tudo como a mesma coisa". Coluna `plataforma`
("wellhub" | "totalpass"); `gympass_id` passa a guardar o identificador da
pessoa na plataforma (o documento da TotalPass pode passar de 20
caracteres).

Revision ID: d5e9b2c84f17
Revises: c3a8f1d27e64
Create Date: 2026-09-30
"""

import sqlalchemy as sa
from alembic import op

revision = "d5e9b2c84f17"
down_revision = "c3a8f1d27e64"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wellhub_checkins",
        sa.Column("plataforma", sa.String(20), nullable=False, server_default="wellhub"),
    )
    op.alter_column(
        "wellhub_checkins", "gympass_id", existing_type=sa.String(20), type_=sa.String(32), existing_nullable=False
    )


def downgrade() -> None:
    op.alter_column(
        "wellhub_checkins", "gympass_id", existing_type=sa.String(32), type_=sa.String(20), existing_nullable=False
    )
    op.drop_column("wellhub_checkins", "plataforma")
