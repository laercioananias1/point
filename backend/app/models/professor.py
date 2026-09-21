from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Professor(TimestampMixin, Base):
    """Entidade global da plataforma — não pertence a nenhum Point específico."""

    __tablename__ = "professores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    contato: Mapped[str] = mapped_column(String(30))  # celular
    email: Mapped[str] = mapped_column(String(255))

    vinculos: Mapped[list["Vinculo"]] = relationship(back_populates="professor")  # noqa: F821

    # Conta de acesso desse professor, só pra ler a foto de perfil (pedido do
    # usuário, 2026-09-21) — mesmo desenho de Aluno.user.
    user: Mapped["User | None"] = relationship(  # noqa: F821
        primaryjoin="User.professor_id == Professor.id",
        foreign_keys="User.professor_id",
        uselist=False,
        viewonly=True,
        lazy="selectin",
    )

    @property
    def foto(self) -> str | None:
        return self.user.foto if self.user is not None else None
