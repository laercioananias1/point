from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import SolicitacaoExperimentalStatus


class SolicitacaoExperimental(TimestampMixin, Base):
    """Pedido de aula experimental feito por um visitante, sem login, numa
    página pública por Point (pedido do usuário, 2026-09-14). Não tem
    Aluno/User nenhum por trás — é só um lead com os dados de contato que
    o próprio visitante informou; a matrícula de verdade só nasce depois,
    se o admin convidar essa pessoa pra virar aluno (mesmo Convite que já
    existe, com os dados aqui só pra pré-preencher — ver
    frontend ConvidarAluno.tsx).

    Ocupa vaga da Turma (pedido do usuário: "mesma capacidade" da turma) —
    enquanto pendente ou aprovada, conta junto com as Matriculas ativas na
    checagem de vaga livre (ver services/aulas.py::vagas_ocupadas_em); só
    libera a vaga se for recusada."""

    __tablename__ = "solicitacoes_experimentais"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"), index=True)
    data: Mapped[date] = mapped_column(Date)

    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    celular: Mapped[str] = mapped_column(String(30))
    # Pergunta fixa pro visitante (pedido do usuário, 2026-09-14: "responder
    # uma pergunta se já tem raquete") — específica de esportes de raquete;
    # fica assim por ora, sem generalizar pra outras modalidades.
    tem_raquete: Mapped[bool] = mapped_column(Boolean)

    status: Mapped[SolicitacaoExperimentalStatus] = mapped_column(
        Enum(SolicitacaoExperimentalStatus), default=SolicitacaoExperimentalStatus.PENDENTE
    )
    decidido_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    motivo_recusa: Mapped[str | None] = mapped_column(String(255), nullable=True)

    turma: Mapped["Turma"] = relationship()  # noqa: F821
    decidido_por: Mapped["User | None"] = relationship()  # noqa: F821

    @property
    def point(self) -> "Point":  # noqa: F821
        return self.turma.vinculo.point
