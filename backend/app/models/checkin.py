from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CheckinOrigem, CheckinStatus


class Checkin(TimestampMixin, Base):
    """Registro de entrada — origem 'presumido' (professor/admin marcando
    presença de próprio punho — pedido do usuário, 2026-08-26: "mostrar
    também os alunos e um check pra marcar presença de cada um") ou
    'totalpass' (pedido do usuário, 2026-08-25: "aceitar os checkins" —
    ver app/services/totalpass.py).

    Check-in TotalPass é "livre": o aluno mostra o código do dia gerado no
    app deles na recepção, o professor ou o admin do Point digita e valida
    na hora — decisão do usuário ("check-in livre, sem reserva"), então
    NÃO exige matrícula nem agendamento prévio. Por isso matricula_id
    continua nulo nesse caso (esse aluno pode nem ter cadastro na
    plataforma) e turma_id passa a ser obrigatório — sem ele, um check-in
    sem matrícula não teria como dizer qual aula/quadra/Point foi.
    """

    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula_id: Mapped[int | None] = mapped_column(ForeignKey("matriculas.id"), nullable=True)
    turma_id: Mapped[int] = mapped_column(ForeignKey("turmas.id"))

    data_hora: Mapped[datetime] = mapped_column(DateTime)
    origem: Mapped[CheckinOrigem] = mapped_column(Enum(CheckinOrigem))
    status: Mapped[CheckinStatus] = mapped_column(
        Enum(CheckinStatus), default=CheckinStatus.CONFIRMADO
    )

    # Quem a TotalPass identificou como beneficiário (pedido do usuário,
    # 2026-08-25) — não existe Aluno cadastrado pra essa pessoa na
    # plataforma (ela é cliente da TotalPass, não do Point diretamente),
    # então guardamos o nome/documento que a própria TotalPass devolveu na
    # validação, só pra conferência/auditoria de quem entrou.
    beneficiario_nome: Mapped[str | None] = mapped_column(String(160), nullable=True)
    beneficiario_documento: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Só registro/histórico — não muda cobrança nem gera crédito (seção 4.4).
    falta_marcada_professor: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    turma: Mapped["Turma"] = relationship()  # noqa: F821
    matricula: Mapped["Matricula | None"] = relationship()  # noqa: F821

    @property
    def aluno_nome(self) -> str | None:
        """Pra CheckinOut expor direto (pedido do usuário, 2026-08-26) —
        presença marcada tem matrícula (e aluno) de verdade; check-in
        TotalPass não (usa beneficiario_nome, é gente sem cadastro aqui)."""
        return self.matricula.aluno.nome if self.matricula else None
