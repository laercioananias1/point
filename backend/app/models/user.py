from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import Role


class User(TimestampMixin, Base):
    """Conta de acesso — separada da entidade de negócio (Professor/Aluno/Point).

    O celular é obrigatório para todos os perfis (canal de notificação, seção 2);
    o login aceita celular OU e-mail como identificador.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Duplicado de Professor.nome/Aluno.nome de propósito: evita um join no
    # login e cobre super_admin/admin_point, que não têm registro de negócio.
    nome: Mapped[str] = mapped_column(String(120))
    celular: Mapped[str] = mapped_column(String(30), unique=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role))

    # Só um destes é preenchido, de acordo com o role.
    professor_id: Mapped[int | None] = mapped_column(ForeignKey("professores.id"), nullable=True)
    aluno_id: Mapped[int | None] = mapped_column(ForeignKey("alunos.id"), nullable=True)
    point_id: Mapped[int | None] = mapped_column(ForeignKey("points.id"), nullable=True)
