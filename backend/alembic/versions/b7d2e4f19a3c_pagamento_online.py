"""Pagamento online (Pix): gateway por Point e Pix por cobrança

Pedido do usuário, 2026-10-02: "desenvolver api do mercado pago para pagto
com pix" — cada Point recebe na própria conta MP; o aluno paga a cobrança
pelo app ou pelo link do e-mail/WhatsApp (/pagar/<token>).

Revision ID: b7d2e4f19a3c
Revises: a3f7c2e91b4d
Create Date: 2026-10-02
"""

import secrets

import sqlalchemy as sa
from alembic import op

revision = "b7d2e4f19a3c"
down_revision = "a3f7c2e91b4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("points", sa.Column("pagamento_gateway", sa.String(20), nullable=True))
    op.add_column("points", sa.Column("pagamento_credencial", sa.String(255), nullable=True))
    op.add_column("points", sa.Column("pagamento_conta", sa.String(160), nullable=True))

    op.add_column("cobrancas", sa.Column("pagamento_token", sa.String(32), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_gateway", sa.String(20), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_pagamento_id", sa.String(60), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_copia_cola", sa.Text(), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_qr_base64", sa.Text(), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_valor", sa.Numeric(10, 2), nullable=True))
    op.add_column("cobrancas", sa.Column("pix_expira_em", sa.DateTime(), nullable=True))
    op.add_column("cobrancas", sa.Column("pago_via", sa.String(10), nullable=True))

    # Cobranças que já existem ganham o código do link de pagamento.
    conn = op.get_bind()
    for (cobranca_id,) in conn.execute(sa.text("SELECT id FROM cobrancas")).fetchall():
        conn.execute(
            sa.text("UPDATE cobrancas SET pagamento_token = :t WHERE id = :id"),
            {"t": secrets.token_urlsafe(24), "id": cobranca_id},
        )
    op.alter_column("cobrancas", "pagamento_token", existing_type=sa.String(32), nullable=False)
    op.create_unique_constraint("uq_cobrancas_pagamento_token", "cobrancas", ["pagamento_token"])
    op.create_index("ix_cobrancas_pix_pagamento_id", "cobrancas", ["pix_pagamento_id"])


def downgrade() -> None:
    op.drop_index("ix_cobrancas_pix_pagamento_id", table_name="cobrancas")
    op.drop_constraint("uq_cobrancas_pagamento_token", "cobrancas", type_="unique")
    for coluna in ("pago_via", "pix_expira_em", "pix_valor", "pix_qr_base64", "pix_copia_cola", "pix_pagamento_id", "pix_gateway", "pagamento_token"):
        op.drop_column("cobrancas", coluna)
    for coluna in ("pagamento_conta", "pagamento_credencial", "pagamento_gateway"):
        op.drop_column("points", coluna)
