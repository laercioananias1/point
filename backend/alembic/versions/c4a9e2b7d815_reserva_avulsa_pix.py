"""aula avulsa com Pix: reserva com prazo

Pedido do usuário, 2026-10-02: a compra de aula avulsa com Pix "segura a
vaga por um tempo" — matrícula AGUARDANDO_PAGAMENTO até reserva_expira_em,
com uma cobrança ligada (cobrancas.matricula_id) e prazo pra pagar
(cobrancas.pagar_ate).

Revision ID: c4a9e2b7d815
Revises: b7d2e4f19a3c
Create Date: 2026-10-02
"""

import sqlalchemy as sa
from alembic import op

revision = "c4a9e2b7d815"
down_revision = "b7d2e4f19a3c"
branch_labels = None
depends_on = None

_ANTES = ("EM_ANALISE", "ATIVA", "RECUSADA", "CANCELADA")
_DEPOIS = _ANTES + ("AGUARDANDO_PAGAMENTO",)


def upgrade() -> None:
    op.alter_column(
        "matriculas",
        "status",
        existing_type=sa.Enum(*_ANTES, name="matriculastatus"),
        type_=sa.Enum(*_DEPOIS, name="matriculastatus"),
        existing_nullable=False,
    )
    op.add_column("matriculas", sa.Column("reserva_expira_em", sa.DateTime(), nullable=True))
    op.add_column("cobrancas", sa.Column("matricula_id", sa.Integer(), nullable=True))
    op.add_column("cobrancas", sa.Column("pagar_ate", sa.DateTime(), nullable=True))
    op.create_foreign_key(
        "fk_cobrancas_matricula_id", "cobrancas", "matriculas", ["matricula_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_cobrancas_matricula_id", "cobrancas", ["matricula_id"])


def downgrade() -> None:
    op.drop_index("ix_cobrancas_matricula_id", table_name="cobrancas")
    op.drop_constraint("fk_cobrancas_matricula_id", "cobrancas", type_="foreignkey")
    op.drop_column("cobrancas", "pagar_ate")
    op.drop_column("cobrancas", "matricula_id")
    op.drop_column("matriculas", "reserva_expira_em")
    op.execute("UPDATE matriculas SET status = 'CANCELADA' WHERE status = 'AGUARDANDO_PAGAMENTO'")
    op.alter_column(
        "matriculas",
        "status",
        existing_type=sa.Enum(*_DEPOIS, name="matriculastatus"),
        type_=sa.Enum(*_ANTES, name="matriculastatus"),
        existing_nullable=False,
    )
