from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ConviteStatus, PagamentoMeio, PeriodoDia


class Convite(TimestampMixin, Base):
    """Convite de assinatura (pedido do usuário, 2026-08-20): o admin
    preenche TUDO — dados do aluno e a assinatura inteira (modalidade,
    plano, turmas, data de início) — e manda um link por e-mail. O aluno só
    aceita: se ainda não tem conta, cria a própria senha; se já tem, só
    faz login e confirma. Em qualquer um dos dois casos, a assinatura ativa
    sozinha no aceite — o admin não precisa voltar depois.

    avulso (pedido do usuário, 2026-09-11: "pode ser um aluno avulso...
    abre opção se for avulso não preenche plano, data início, forma de
    pagto, turma, nada disso") — quando True, o convite é só pra criar a
    conta; os 5 campos de assinatura abaixo ficam nulos e o aceite não cria
    Assinatura/Matricula nenhuma (mesmo espírito de POST /alunos
    self-service). O aluno entra e compra as próprias aulas quando quiser."""

    __tablename__ = "convites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"))

    # Identidade de quem tá sendo convidado — vira Aluno+User só no aceite.
    # Celular não entra mais aqui (pedido do usuário, 2026-08-26: "tira
    # desse cadastro celular") — quem informa o próprio celular agora é o
    # aluno, na hora de aceitar (ConviteAceitarNovo), não o admin no convite.
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160))

    avulso: Mapped[bool] = mapped_column(Boolean, default=False)

    # A assinatura inteira, já decidida pelo admin — vira Assinatura de
    # verdade só no aceite (pra poder revalidar turma/plano nesse meio-tempo).
    # Nulos quando avulso=True.
    modalidade_id: Mapped[int | None] = mapped_column(ForeignKey("modalidades.id"), nullable=True)
    periodo_dia_desejado: Mapped[PeriodoDia | None] = mapped_column(Enum(PeriodoDia), nullable=True)
    fonte_pagamento: Mapped[PagamentoMeio | None] = mapped_column(Enum(PagamentoMeio), nullable=True)
    plano_id: Mapped[int | None] = mapped_column(ForeignKey("planos.id"), nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[ConviteStatus] = mapped_column(Enum(ConviteStatus), default=ConviteStatus.PENDENTE)
    expira_em: Mapped[date] = mapped_column(Date)
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assinatura_id: Mapped[int | None] = mapped_column(ForeignKey("assinaturas.id"), nullable=True)

    point: Mapped["Point"] = relationship()  # noqa: F821
    modalidade: Mapped["Modalidade | None"] = relationship()  # noqa: F821
    plano: Mapped["Plano | None"] = relationship()  # noqa: F821
    assinatura: Mapped["Assinatura | None"] = relationship()  # noqa: F821
    dias_escolhidos_rel: Mapped[list["ConviteDiaEscolhido"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan"
    )

    @property
    def expirado(self) -> bool:
        return self.status == ConviteStatus.PENDENTE and self.expira_em < date.today()

    def dias_por_turma(self) -> dict[int, list[str]]:
        """{turma_id: [dias escolhidos]} — pedido do usuário, 2026-08-21:
        cada Turma escolhida pode contribuir só uma parte dos seus dias.
        Ordenado segunda→domingo, igual Turma.dias_semana."""
        from app.services.aulas import DIAS_SEMANA

        ordem = {dia: i for i, dia in enumerate(DIAS_SEMANA)}
        resultado: dict[int, list[str]] = {}
        for d in self.dias_escolhidos_rel:
            resultado.setdefault(d.turma_id, []).append(d.dia_semana)
        for turma_id, dias in resultado.items():
            dias.sort(key=lambda d: ordem.get(d, len(DIAS_SEMANA)))
        return resultado
