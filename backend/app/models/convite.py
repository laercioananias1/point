from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
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
    sozinha no aceite — o admin não precisa voltar depois."""

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

    # A assinatura inteira, já decidida pelo admin — vira Assinatura de
    # verdade só no aceite (pra poder revalidar turma/plano nesse meio-tempo).
    modalidade_id: Mapped[int] = mapped_column(ForeignKey("modalidades.id"))
    periodo_dia_desejado: Mapped[PeriodoDia] = mapped_column(Enum(PeriodoDia))
    fonte_pagamento: Mapped[PagamentoMeio] = mapped_column(Enum(PagamentoMeio))
    plano_id: Mapped[int] = mapped_column(ForeignKey("planos.id"))
    data_inicio: Mapped[date] = mapped_column(Date)

    status: Mapped[ConviteStatus] = mapped_column(Enum(ConviteStatus), default=ConviteStatus.PENDENTE)
    expira_em: Mapped[date] = mapped_column(Date)
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assinatura_id: Mapped[int | None] = mapped_column(ForeignKey("assinaturas.id"), nullable=True)

    point: Mapped["Point"] = relationship()  # noqa: F821
    modalidade: Mapped["Modalidade"] = relationship()  # noqa: F821
    plano: Mapped["Plano"] = relationship()  # noqa: F821
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
