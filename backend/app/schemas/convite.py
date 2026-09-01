from datetime import date

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
    (pedido do usuário, 2026-08-20). Sem celular (pedido do usuário,
    2026-08-26) — o próprio aluno informa o dele ao aceitar."""

    nome: str
    email: str
    modalidade_id: int
    periodo_dia_desejado: PeriodoDia
    fonte_pagamento: PagamentoMeio
    plano_id: int
    turmas: list[ConviteTurmaEscolha]
    data_inicio: date


class ConviteTurmaEscolhaOut(ORMModel):
    turma: TurmaOut
    dias_semana: list[str]


class ConviteOut(ORMModel):
    id: int
    token: str
    nome: str
    email: str
    point: PointResumo
    modalidade: ModalidadeOut
    plano: PlanoOut
    # Pedido do usuário, 2026-09-01: "quando o plano é wellhub ou totalpass
    # nao pode mostrar o valor do plano... Informe o beneficio" — a tela de
    # aceite (e o e-mail do convite) precisam saber disso pra decidir o que
    # mostrar no lugar do preço.
    fonte_pagamento: PagamentoMeio
    turmas: list[ConviteTurmaEscolhaOut]
    data_inicio: date
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
