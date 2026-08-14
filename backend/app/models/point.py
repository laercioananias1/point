from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Point(TimestampMixin, Base):
    """O local/quadra. Cliente pagante do SaaS (seção 6)."""

    __tablename__ = "points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    endereco: Mapped[str] = mapped_column(String(255))

    # Lista simples de nomes de quadra (ex.: ["Quadra 1", "Quadra 2"]). Uma
    # entidade Quadra própria (com fotos, tipo de piso etc.) pode substituir
    # isso quando o cadastro do Point precisar de mais detalhe.
    quadras: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Formas de pagamento habilitadas para este Point — controlado SÓ pelo
    # dono do app (seção 4.1), nunca pelo admin do Point.
    formas_pagamento_habilitadas: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Prazo de validade do crédito de reposição, em dias — cada Point define o seu.
    prazo_credito_dias: Mapped[int] = mapped_column(Integer, default=30)

    # Credencial Wellhub/TotalPass — nula até a Fase 2 (integração de benefícios).
    place_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    vinculos: Mapped[list["Vinculo"]] = relationship(back_populates="point")  # noqa: F821
