from app.models.point import DIAS_FIM_DE_SEMANA, DIAS_UTEIS, HORARIOS_PADRAO
from app.schemas.common import ORMModel


class PointCreate(ORMModel):
    nome: str
    endereco: str
    prazo_credito_dias: int = 30
    prazo_cancelamento_horas: int = 2
    dia_vencimento_mensalidade: int = 10
    dias_semana_funcionamento: list[str] = DIAS_UTEIS
    horarios_semana_funcionamento: list[str] = HORARIOS_PADRAO
    dias_fds_funcionamento: list[str] = DIAS_FIM_DE_SEMANA
    horarios_fds_funcionamento: list[str] = HORARIOS_PADRAO


class PointOut(ORMModel):
    id: int
    nome: str
    endereco: str
    formas_pagamento_habilitadas: list[str]
    prazo_credito_dias: int
    prazo_cancelamento_horas: int
    dia_vencimento_mensalidade: int
    dias_semana_funcionamento: list[str]
    horarios_semana_funcionamento: list[str]
    dias_fds_funcionamento: list[str]
    horarios_fds_funcionamento: list[str]
    # Credencial TotalPass/Wellhub desse Point (pedido do usuário,
    # 2026-08-25) — cada Point pega a dele no portal da TotalPass, aba
    # "Integrações". Nula até o admin configurar.
    place_api_key: str | None
    # Perfil público do Point (pedido do usuário, 2026-08-30) — ver
    # app/models/point.py.
    sobre: str | None
    informacoes_importantes: str | None
    fotos: list[str]
    anuncios: str | None
    banners: list[str]
    logo: str | None


class PointLogoOut(ORMModel):
    """Resolve o Point do usuário logado, seja qual for o papel (pedido do
    usuário, 2026-08-30: "logomarca... no canto esquerdo", pra todo mundo)
    — usado só pelo cabeçalho (Layout.tsx) pra saber qual logo mostrar,
    sem cada tela repetir essa resolução. Sem Point (dono do app, ou
    professor/aluno sem nenhum vínculo/matrícula ativa ainda), os três
    campos vêm nulos e o cabeçalho cai na marca genérica do app."""

    point_id: int | None
    nome: str | None
    logo: str | None


class PointPerfilUpdate(ORMModel):
    """Nome, endereço, "Sobre", "Informações importantes" e "Anúncios" do
    Point (pedido do usuário, 2026-08-30: "Meu Point... um cadastro de
    Sobre... um cadastro de informações importantes" / "na parte do meio
    vai colocar anúncios que também deve ser cadastrado dentro do Meu
    Point" / "precisa tb no cadastro do point: Nome do point, endereço")
    — as fotos/banners têm endpoints próprios (upload multipart não cabe
    num PATCH de JSON), ver POST/DELETE /points/me/fotos|banners."""

    nome: str
    endereco: str
    sobre: str | None = None
    informacoes_importantes: str | None = None
    anuncios: str | None = None


class PointConfiguracoesUpdate(ORMModel):
    """Configurações que o próprio admin do Point ajusta (pedido do
    usuário, 2026-08-21) — diferente de formas_pagamento_habilitadas, que
    só o dono do app mexe. Dias úteis e fim de semana ficam separados
    (pedido do usuário, 2026-08-21: sábado costuma ter só parte da manhã,
    bem diferente do horário de semana)."""

    prazo_credito_dias: int
    prazo_cancelamento_horas: int
    # Dia do mês em que a mensalidade vence (pedido do usuário, 2026-08-21).
    # 1-28 pra existir em qualquer mês, mesmo fevereiro.
    dia_vencimento_mensalidade: int
    dias_semana_funcionamento: list[str]
    horarios_semana_funcionamento: list[str]
    dias_fds_funcionamento: list[str]
    horarios_fds_funcionamento: list[str]
    # Credencial TotalPass/Wellhub (pedido do usuário, 2026-08-25) — igual
    # aos outros campos deste schema, o formulário sempre reenvia o valor
    # atual (nulo/vazio se ainda não configurado).
    place_api_key: str | None


class PointResumo(ORMModel):
    """Versão enxuta para o professor escolher um Point ao solicitar vínculo —
    sem expor formas_pagamento_habilitadas/prazo_credito_dias, que são dados
    de gestão do Point. dias/horarios_funcionamento entram aqui (não são
    dado sensível, tipo horário de funcionamento numa vitrine) pro professor
    já ver, ao criar turma, o que o Point permite (pedido do usuário,
    2026-08-21)."""

    id: int
    nome: str
    endereco: str
    dias_semana_funcionamento: list[str]
    horarios_semana_funcionamento: list[str]
    dias_fds_funcionamento: list[str]
    horarios_fds_funcionamento: list[str]
    # Pedido do usuário, 2026-08-26 (agenda do aluno) — pra mostrar o prazo
    # de verdade na tela, em vez de um aviso genérico sem número.
    prazo_cancelamento_horas: int
    # Perfil do Point pra Início do aluno (pedido do usuário, 2026-08-30) —
    # ver PointOut.sobre/informacoes_importantes/fotos/anuncios/banners/logo.
    sobre: str | None
    informacoes_importantes: str | None
    fotos: list[str]
    anuncios: str | None
    banners: list[str]
    logo: str | None


class PointRankingOut(ORMModel):
    """Dashboard comparativo entre Points, só pro dono do app (seção 6.5)."""

    point_id: int
    nome: str
    professores_ativos: int
    alunos_ativos: int
    # Calculada na hora (pedido do usuário, 2026-08-26: "os números da visão
    # geral" estavam presos ao fechamento — um Point com pagamento confirmado
    # de verdade aparecia com R$0 até alguém rodar um fechamento manual pra
    # ele). Fórmula simples e sem ambiguidade: nº de pagamentos confirmados
    # × taxa por pagamento vigente agora — a mesma conta que o fechamento já
    # faz, só que sem esperar ele rodar.
    total_taxa_servico: float
    # Continua vindo só dos fechamentos já gerados — é dinheiro que já foi
    # de fato conferido e reconciliado, não dá pra estimar isso ao vivo sem
    # arriscar um número errado (repasse "valor fixo mensal" não tem uma
    # leitura óbvia de "quanto seria até agora" sem fechamento nenhum).
    total_repassado: float
    # Novo (pedido do usuário, 2026-08-26) — soma bruta de todo pagamento
    # confirmado desse Point, sem entrar em taxa/repasse: dá visão de
    # volume mesmo pra quem nunca rodou um fechamento.
    total_pago_confirmado: float
