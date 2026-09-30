"""wellhub_checkins: e-mail e telefone vindos do evento do webhook

Revision ID: c3a8f1d27e64
Revises: b7d2e4a91c3f
Create Date: 2026-09-30
"""

import sqlalchemy as sa
from alembic import op

revision = "c3a8f1d27e64"
down_revision = "b7d2e4a91c3f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wellhub_checkins", sa.Column("email_wellhub", sa.String(255), nullable=True))
    op.add_column("wellhub_checkins", sa.Column("telefone_wellhub", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("wellhub_checkins", "telefone_wellhub")
    op.drop_column("wellhub_checkins", "email_wellhub")
