from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ExperimentalConfig


class Turma(TimestampMixin, Base):
    """Pertence a 1 Vínculo (1 professor + 1 Point); elo com os alunos via Matrícula.

    Uma Turma é o grupo/horário recorrente inteiro — "beach tênis iniciante,
    seg/qua/sex 8h" é UMA turma, com 3 linhas em TurmaDiaSemana (pedido do
    usuário, 2026-08-20: "a turma não deveria ser uma pra n dias?"). Antes
    cada dia virava uma Turma separada, o que fragmentava Matrícula/Pagamento
    de um mesmo plano em vários registros artificiais — ver decisão registrada
    ali. horário/duração/quadra/capacidade continuam únicos por Turma: todo
    dia que ela acontece é no mesmo horário. Dois horários diferentes (ex.:
    8h e 18h) continuam sendo duas Turmas — o endpoint de criação faz 1 Turma
    por horário selecionado, cada uma cobrindo todos os dias marcados.

    periodo_inicio/periodo_fim delimitam a vigência — além de dizer até quando
    a turma roda, é o que permite checar conflito de agenda do professor: duas
    turmas do mesmo professor, mesmo dia_semana e horário, só colidem de
    verdade se os períodos se sobrepõem. periodo_fim nulo = recorrente sem
    data de término (pedido do usuário, 2026-08-20) — todo lugar que compara
    com periodo_fim precisa tratar NULL como 'nunca termina', não como
    'não sabemos'."""

    __tablename__ = "turmas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vinculo_id: Mapped[int] = mapped_column(ForeignKey("vinculos.id"))
    modalidade_id: Mapped[int] = mapped_column(ForeignKey("modalidades.id"))
    quadra_id: Mapped[int] = mapped_column(ForeignKey("quadras.id"))
    # Nível/categoria do aluno (pedido do usuário, 2026-09-08) — cadastrada
    # pelo admin do Point (nome + cor); a turma é exclusiva dessa categoria.
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"))
    # Tipo/formato (pedido do usuário, 2026-09-09) — ex.: 'Padrão', 'Aula
    # individual', 'Dupla', 'Família'. Só etiqueta organizacional, cadastrada
    # pelo Point (ver TipoTurma.__doc__).
    tipo_turma_id: Mapped[int] = mapped_column(ForeignKey("tipos_turma.id"))
    # Independente do tipo (pedido do usuário, 2026-09-09: "o ser privado ou
    # não tem que ser na turma e não no tipo") — quando True, o aluno não
    # consegue se auto-matricular (comprar avulsa ou reagendar crédito
    # sozinho): só o professor/admin do Point matricula alguém aqui. Ver
    # bloqueio em routers/matriculas.py::solicitar_matricula e
    # routers/creditos.py::_reagendar_credito.
    privada: Mapped[bool] = mapped_column(Boolean, default=False)

    # Programa de aula experimental (pedido do usuário, 2026-09-14) — 'nao'
    # (padrão) não participa; 'aceita' é turma normal que também abre vaga
    # livre pra visitante experimentar; 'somente' é dedicada só a isso, sem
    # matrícula normal (ver ExperimentalConfig.__doc__, bloqueios em
    # matriculas.py/creditos.py mesmo espírito de `privada`).
    aula_experimental: Mapped[ExperimentalConfig] = mapped_column(
        Enum(ExperimentalConfig), default=ExperimentalConfig.NAO
    )

    capacidade: Mapped[int] = mapped_column(Integer)

    horario: Mapped[str] = mapped_column(String(5))  # "HH:00" — sempre hora cheia
    duracao_minutos: Mapped[int] = mapped_column(Integer, default=60)
    recorrencia: Mapped[str] = mapped_column(String(30), default="semanal")
    periodo_inicio: Mapped[date] = mapped_column(Date)
    periodo_fim: Mapped[date | None] = mapped_column(Date, nullable=True)

    vinculo: Mapped["Vinculo"] = relationship(back_populates="turmas")  # noqa: F821
    modalidade: Mapped["Modalidade"] = relationship()  # noqa: F821
    quadra: Mapped["Quadra"] = relationship()  # noqa: F821
    categoria: Mapped["Categoria"] = relationship()  # noqa: F821
    tipo_turma: Mapped["TipoTurma"] = relationship()  # noqa: F821
    matriculas: Mapped[list["Matricula"]] = relationship(back_populates="turma")  # noqa: F821
    excecoes_rel: Mapped[list["TurmaExcecao"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan"
    )
    dias_semana_rel: Mapped[list["TurmaDiaSemana"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan"
    )

    @property
    def professor_nome(self) -> str:
        """Só o nome, pra vitrine pública de aula experimental (pedido do
        usuário, 2026-09-14) — sem expor contato/e-mail do professor pra
        quem não está logado."""
        return self.vinculo.professor.nome

    @property
    def excecoes(self) -> list[date]:
        """Só as datas, pra TurmaOut expor direto (seção pedido do usuário,
        2026-08-20) sem precisar aninhar TurmaExcecao como schema."""
        return [e.data for e in self.excecoes_rel]

    @property
    def cancelamentos(self) -> list["TurmaExcecao"]:  # noqa: F821
        """Mesma lista de excecoes_rel, com nome mais claro pro schema novo
        (TurmaCancelamentoOut: data + motivo) — pedido do usuário,
        2026-09-01: mostrar o motivo do cancelamento no calendário.
        `excecoes` continua existindo só com as datas, sem mexer em quem já
        usa esse campo pra filtrar ocorrência (services/aulas.py e o
        cálculo de agenda no front)."""
        return self.excecoes_rel

    @property
    def dias_semana(self) -> list[str]:
        """Dias da semana, na ordem segunda→domingo (não na ordem em que
        foram cadastrados), pra TurmaOut expor direto sem aninhar schema.
        Um valor fora da lista (não deveria existir — TurmaCreate já valida
        contra DIAS_SEMANA — mas achamos uma linha de teste com lixo assim
        em dev, 2026-08-20) só vai pro fim em vez de derrubar a resposta."""
        from app.services.aulas import DIAS_SEMANA

        ordem = {dia: i for i, dia in enumerate(DIAS_SEMANA)}
        return sorted(
            (d.dia_semana for d in self.dias_semana_rel), key=lambda d: ordem.get(d, len(DIAS_SEMANA))
        )
