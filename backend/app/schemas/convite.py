from datetime import date

from pydantic import model_validator

from app.models.enums import ConviteStatus, PagamentoMeio, PeriodoDia
from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.plano import PlanoOut
from app.schemas.point import PointResumo
from app.schemas.turma import TurmaOut


class ConviteTurmaEscolha(ORMModel):
    """Uma Turma escolhida e os dias dela que esse aluno vai frequentar —
    pedido do usuário, 2026-08-21: a Turma pode ter mais dias do que esse
    aluno específico usa (outros alunos completam o resto)."""

    turma_id: int
    dias_semana: list[str]


class ConviteCriar(ORMModel):
    """O admin decide a assinatura inteira aqui — o aluno só vai aceitar
    (pedido do usuário, 2026-08-20).

    avulso (pedido do usuário, 2026-09-11): quando True, é só um convite
    pra entrar na plataforma — os 5 campos de assinatura abaixo ficam
    None/vazio e não são exigidos; o aluno compra as próprias aulas
    depois. Quando False (padrão, comportamento de sempre), todos são
    obrigatórios — validado abaixo em vez de só no tipo, pra dar uma
    mensagem clara em vez do erro genérico de campo ausente."""

    nome: str
    email: str
    # Obrigatório (pedido do usuário, 2026-09-11: "não é mais opcional o
    # celular, devido agora começar utilizar whats precisa") — o convite
    # sempre sai por WhatsApp também, além do e-mail; igual professor/admin.
    celular: str
    avulso: bool = False
    modalidade_id: int | None = None
    periodo_dia_desejado: PeriodoDia | None = None
    fonte_pagamento: PagamentoMeio | None = None
    plano_id: int | None = None
    turmas: list[ConviteTurmaEscolha] = []
    data_inicio: date | None = None

    @model_validator(mode="after")
    def _exige_assinatura_se_nao_avulso(self) -> "ConviteCriar":
        if self.avulso:
            return self
        faltando = [
            campo
            for campo, valor in (
                ("modalidade_id", self.modalidade_id),
                ("periodo_dia_desejado", self.periodo_dia_desejado),
                ("fonte_pagamento", self.fonte_pagamento),
                ("plano_id", self.plano_id),
                ("data_inicio", self.data_inicio),
            )
            if valor is None
        ]
        if not self.turmas:
            faltando.append("turmas")
        if faltando:
            raise ValueError(
                f"Convite com plano precisa de: {', '.join(faltando)} (ou marque avulso=true)"
            )
        return self


class ConviteTurmaEscolhaOut(ORMModel):
    turma: TurmaOut
    dias_semana: list[str]


class ConviteOut(ORMModel):
    id: int
    token: str
    nome: str
    email: str
    celular: str
    point: PointResumo
    avulso: bool
    # Todos None quando avulso=True (pedido do usuário, 2026-09-11).
    modalidade: ModalidadeOut | None
    plano: PlanoOut | None
    # Pedido do usuário, 2026-09-01: "quando o plano é wellhub ou totalpass
    # nao pode mostrar o valor do plano... Informe o beneficio" — a tela de
    # aceite (e o e-mail do convite) precisam saber disso pra decidir o que
    # mostrar no lugar do preço.
    fonte_pagamento: PagamentoMeio | None
    turmas: list[ConviteTurmaEscolhaOut]
    data_inicio: date | None
    status: ConviteStatus
    expira_em: date
    expirado: bool
    # Calculado na hora — se já existe conta com esse celular, a tela de
    # aceite pede login em vez de criar senha nova.
    aluno_ja_cadastrado: bool = False


class ConviteAceitarNovo(ORMModel):
    # Celular passou a ser informado aqui, pelo próprio aluno (pedido do
    # usuário, 2026-08-26) — antes vinha do que o admin preenchia no
    # convite; User.celular continua obrigatório (canal de notificação).
    celular: str
    senha: str
