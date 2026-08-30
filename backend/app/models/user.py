from sqlalchemy import ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import Role


class User(TimestampMixin, Base):
    """Conta de acesso — separada da entidade de negócio (Professor/Aluno/Point).

    O celular é obrigatório para todos os perfis (canal de notificação, seção 2),
    mas o login é sempre por e-mail (pedido do usuário, 2026-08-21 — celular
    "não dá muito certo" como identificador de login). Só e-mail é único —
    é o login de todo mundo; celular não precisa mais ser (pedido do
    usuário, 2026-08-21: "tira essa trava de celular... trava só em email").

    Uma conta pode acumular mais de um papel (pedido do usuário, 2026-08-26:
    "eu vou ter cliente que é bem pequeno, o dono do Point é também o
    professor" — antes o modelo travava em UM role por conta, sem jeito de
    representar isso sem duas contas/dois e-mails). `roles` é a lista de
    papéis que essa conta tem; `professor_id`/`aluno_id`/`point_id` ficam
    preenchidos conforme os papéis presentes em `roles` (pode ter mais de
    um preenchido agora — deixou de ser "só um dos três", que era a regra
    antiga quando só existia um role por conta).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Duplicado de Professor.nome/Aluno.nome de propósito: evita um join no
    # login e cobre super_admin/admin_point, que não têm registro de negócio.
    nome: Mapped[str] = mapped_column(String(120))
    celular: Mapped[str] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    # Lista de valores de Role (ex.: ["admin_point", "professor"]) — JSON
    # porque MySQL não tem array nativo; sempre não-vazia na prática (toda
    # conta nasce com pelo menos um papel).
    roles: Mapped[list[str]] = mapped_column(JSON)

    professor_id: Mapped[int | None] = mapped_column(ForeignKey("professores.id"), nullable=True)
    aluno_id: Mapped[int | None] = mapped_column(ForeignKey("alunos.id"), nullable=True)
    point_id: Mapped[int | None] = mapped_column(ForeignKey("points.id"), nullable=True)

    def tem_role(self, role: Role) -> bool:
        return role.value in self.roles
