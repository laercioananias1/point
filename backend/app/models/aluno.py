from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import FormaPagamento


class Aluno(TimestampMixin, Base):
    """Entidade global da plataforma — pode se matricular em vários Points/professores."""

    __tablename__ = "alunos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    contato: Mapped[str] = mapped_column(String(30))  # celular
    email: Mapped[str] = mapped_column(String(255))
    # Nullable (pedido do usuário, 2026-09-11) — aluno vindo de convite
    # avulso não informa forma de pagamento nenhuma no cadastro; escolhe na
    # hora de comprar a primeira aula.
    forma_pagamento_preferida: Mapped[FormaPagamento | None] = mapped_column(
        Enum(FormaPagamento), nullable=True
    )
    # Gympass ID de 13 dígitos (pedido do usuário, 2026-09-29, protocolo
    # 15968485) — liga os check-ins que chegam da Wellhub (ver
    # app/models/wellhub_checkin.py) a esse Aluno, pro "acerto do mês"
    # conseguir comparar check-ins feitos com aulas frequentadas. Nulo até
    # alguém associar uma vez (PATCH /alunos/{id}/wellhub); único porque um
    # gympass_id só pode representar uma pessoa.
    wellhub_gympass_id: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)

    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="aluno")  # noqa: F821

    # Conta de acesso desse aluno, só pra ler a foto de perfil (pedido do
    # usuário, 2026-09-21: "na tela de alunos mostra a fotinha") — Aluno é
    # entidade de negócio, a foto mora em User. selectin: carrega a conta de
    # vários alunos numa consulta só em vez de uma por aluno da lista.
    user: Mapped["User | None"] = relationship(  # noqa: F821
        primaryjoin="User.aluno_id == Aluno.id",
        foreign_keys="User.aluno_id",
        uselist=False,
        viewonly=True,
        lazy="selectin",
    )

    @property
    def foto(self) -> str | None:
        return self.user.foto if self.user is not None else None
