"""régua de cobrança: etapas ligadas por Point + registro de lembretes

Pedido do usuário, 2026-10-01: "pode fazer a régua de cobrança" — o Point
escolhe em quais etapas (dias em relação ao vencimento) o aluno recebe
lembrete automático; cada envio (automático ou manual) fica registrado em
cobranca_lembretes, que é o que impede mandar a mesma etapa duas vezes.

Revision ID: e8c4a1d6b902
Revises: d5e9b2c84f17
Create Date: 2026-10-01
"""

import sqlalchemy as sa
from alembic import op

revision = "e8c4a1d6b902"
down_revision = "d5e9b2c84f17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nulo = régua desligada (nenhuma etapa).
    op.add_column("points", sa.Column("regua_cobranca", sa.JSON(), nullable=True))
    op.create_table(
        "cobranca_lembretes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "cobranca_id",
            sa.Integer(),
            sa.ForeignKey("cobrancas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("etapa", sa.Integer(), nullable=True),
        sa.Column("origem", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cobranca_lembretes_cobranca_id", "cobranca_lembretes", ["cobranca_id"])


def downgrade() -> None:
    op.drop_index("ix_cobranca_lembretes_cobranca_id", table_name="cobranca_lembretes")
    op.drop_table("cobranca_lembretes")
    op.drop_column("points", "regua_cobranca")
