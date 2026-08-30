from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin

# Mesma ordem usada em toda parte (services/aulas.py, frontend/lib/dias.ts).
# Duplicado aqui (em vez de importar de services) pra não inverter a
# dependência model -> service; é só uma lista literal, estável.
DIAS_SEMANA_PADRAO = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
DIAS_UTEIS = ["segunda", "terça", "quarta", "quinta", "sexta"]
DIAS_FIM_DE_SEMANA = ["sábado", "domingo"]
# Mesma janela usada no seletor de horário da turma (5h..23h, hora cheia).
HORARIOS_PADRAO = [f"{h:02d}:00" for h in range(5, 24)]


class Point(TimestampMixin, Base):
    """O local/quadra. Cliente pagante do SaaS (seção 6)."""

    __tablename__ = "points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    endereco: Mapped[str] = mapped_column(String(255))

    # Quadras e modalidades viraram entidades próprias (app/models/quadra.py,
    # app/models/modalidade.py) — antes eram só uma lista de nomes aqui.

    # Formas de pagamento habilitadas para este Point — controlado SÓ pelo
    # dono do app (seção 4.1), nunca pelo admin do Point.
    formas_pagamento_habilitadas: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Prazo de validade do crédito de reposição, em dias — cada Point define o seu.
    prazo_credito_dias: Mapped[int] = mapped_column(Integer, default=30)

    # Antecedência mínima, em horas, pra aluno cancelar uma aula e ganhar
    # crédito (pedido do usuário, 2026-08-21) — padrão 2h; cada Point pode
    # ajustar o seu. Usado em cancelar_aula_matricula (routers/matriculas.py).
    prazo_cancelamento_horas: Mapped[int] = mapped_column(Integer, default=2)

    # Dia do mês em que a mensalidade vence (pedido do usuário, 2026-08-21:
    # "a data de pagamento tem vencimento?" — não tinha, só o prazo implícito
    # de fim de mês). Padrão dia 10; cada Point pode ajustar o seu. Limitado
    # a 1-28 (services/aulas.py::matricula_inadimplente) pra existir em
    # qualquer mês, mesmo fevereiro. Antes do vencimento do mês corrente,
    # ainda cobra o mês anterior; a partir dele, passa a cobrar o corrente.
    dia_vencimento_mensalidade: Mapped[int] = mapped_column(Integer, default=10)

    # Dias/horários em que o Point funciona (pedido do usuário, 2026-08-21),
    # separado em dias úteis x fim de semana — porque sábado costuma ter só
    # um pedaço da manhã, bem diferente do horário de semana (pedido do
    # usuário, 2026-08-21: "no sábado normalmente as aulas é só parte da
    # manhã"). Limita o que o professor pode escolher ao criar turma. Nasce
    # com tudo liberado (5h-23h nos dois grupos) e o admin restringe se
    # precisar — nunca começa fechado.
    dias_semana_funcionamento: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(DIAS_UTEIS)
    )
    horarios_semana_funcionamento: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(HORARIOS_PADRAO)
    )
    dias_fds_funcionamento: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(DIAS_FIM_DE_SEMANA)
    )
    horarios_fds_funcionamento: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(HORARIOS_PADRAO)
    )

    # Credencial Wellhub/TotalPass — nula até a Fase 2 (integração de benefícios).
    place_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Perfil do Point (pedido do usuário, 2026-08-30: "Meu Point... Sobre,
    # informações importantes, até 5 fotos") — sobre/informacoes_importantes
    # e fotos aparecem no fim da Início do aluno (depois de "Próximas
    # aulas"); fotos é uma lista de URLs (/uploads/..., servidas como
    # arquivo estático — ver app/services/uploads.py e app/main.py),
    # limitada a MAX_FOTOS_POINT (app/routers/points.py) na hora de
    # adicionar, não aqui no modelo.
    sobre: Mapped[str | None] = mapped_column(Text, nullable=True)
    informacoes_importantes: Mapped[str | None] = mapped_column(Text, nullable=True)
    fotos: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Anúncios (pedido do usuário, 2026-08-30: "na parte do meio vai
    # colocar anúncios que também deve ser cadastrado dentro do Meu
    # Point") — preenche o banner reservado no meio da Início do aluno
    # (antes um placeholder fixo "espaço reservado pra avisos do Point");
    # sobre/informações/fotos viraram um bloco separado, no fim da página.
    # `anuncios` é o texto livre; `banners` (pedido do usuário, 2026-08-30:
    # "anúncios será imagens também, como banners") é uma lista de imagens
    # promocionais, mesmo esquema de `fotos` (upload próprio, limite em
    # MAX_BANNERS_POINT — app/routers/points.py), exibidas em carrossel
    # junto do texto.
    anuncios: Mapped[str | None] = mapped_column(Text, nullable=True)
    banners: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Logomarca do próprio Point (pedido do usuário, 2026-08-30: "coloque
    # também um ícone (logomarca do point)... precisa também ser mostrado
    # no canto esquerdo") — slot único (não é lista como fotos/banners),
    # substitui a marca genérica do app no canto esquerdo do cabeçalho pra
    # quem está logado nesse Point (qualquer papel — GET /points/meu-logo
    # resolve o Point do usuário e devolve isso, ver app/routers/points.py
    # e components/Layout.tsx).
    logo: Mapped[str | None] = mapped_column(String(255), nullable=True)

    vinculos: Mapped[list["Vinculo"]] = relationship(back_populates="point")  # noqa: F821
