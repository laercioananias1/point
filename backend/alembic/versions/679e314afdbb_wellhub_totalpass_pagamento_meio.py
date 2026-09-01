"""wellhub_totalpass_pagamento_meio

Revision ID: 679e314afdbb
Revises: 0b46492a7eba
Create Date: 2026-09-01 17:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import mysql

revision: str = '679e314afdbb'
down_revision: Union[str, None] = '0b46492a7eba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Alembic autogenerate não detecta ENUM ampliado no MySQL sozinho (pedido
# do usuário, 2026-09-01: "ja vamos aceitar matriculas com essas formas" —
# Wellhub/TotalPass em PagamentoMeio) — escrito à mão. As 4 colunas que
# usam esse enum (ver app/models/enums.py::PagamentoMeio).
TABELAS_COLUNAS = [
    ("matriculas", "fonte_pagamento"),
    ("convites", "fonte_pagamento"),
    ("assinaturas", "fonte_pagamento"),
    ("pagamentos", "meio"),
]


def upgrade() -> None:
    for tabela, coluna in TABELAS_COLUNAS:
        op.alter_column(
            tabela,
            coluna,
            existing_type=mysql.ENUM("PIX", "DINHEIRO"),
            type_=mysql.ENUM("PIX", "DINHEIRO", "WELLHUB", "TOTALPASS"),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Sem registro nenhum usando WELLHUB/TOTALPASS ainda nas colunas
    # revertidas seria preciso migrar os dados antes — não faz isso aqui
    # de propósito (downgrade é raramente usado neste projeto; se algum
    # dia precisar, trate esse caso manualmente antes de rodar).
    for tabela, coluna in TABELAS_COLUNAS:
        op.alter_column(
            tabela,
            coluna,
            existing_type=mysql.ENUM("PIX", "DINHEIRO", "WELLHUB", "TOTALPASS"),
            type_=mysql.ENUM("PIX", "DINHEIRO"),
            existing_nullable=False,
        )
