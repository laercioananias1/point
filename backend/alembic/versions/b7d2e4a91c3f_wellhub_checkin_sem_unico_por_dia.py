"""wellhub_checkins: sem trava de um check-in por dia

Cada check-in que a Wellhub validar conta (pedido do usuário, 2026-09-30:
"se ele não der erro deixa computar todos") — a duplicidade quem barra é
a própria Wellhub ("Check-In already validated").

Revision ID: b7d2e4a91c3f
Revises: f1ec6e2fec0e
Create Date: 2026-09-30
"""

from alembic import op

revision = "b7d2e4a91c3f"
down_revision = "f1ec6e2fec0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Constraint criada sem nome em 1a409560c50a — no MySQL ela herda o
    # nome da primeira coluna. A FK de point_id continua coberta por
    # ix_wellhub_checkins_point_id.
    op.drop_constraint("point_id", "wellhub_checkins", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("point_id", "wellhub_checkins", ["point_id", "gympass_id", "data"])
