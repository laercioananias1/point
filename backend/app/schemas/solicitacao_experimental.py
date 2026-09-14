from datetime import date, datetime

from app.models.enums import SolicitacaoExperimentalStatus
from app.schemas.categoria import CategoriaOut
from app.schemas.common import ORMModel
from app.schemas.modalidade import ModalidadeOut
from app.schemas.point import PointResumo
from app.schemas.quadra import QuadraOut


class TurmaExperimentalOut(ORMModel):
    """Versão pública da Turma pra página de aula experimental (pedido do
    usuário, 2026-09-14) — sem login nenhum de por trás, então só o que é
    seguro mostrar pra qualquer visitante: nada de contato do professor
    (nome dele tudo bem, é uma vitrine)."""

    id: int
    modalidade: ModalidadeOut
    quadra: QuadraOut
    categoria: CategoriaOut
    professor_nome: str
    dias_semana: list[str]
    horario: str
    duracao_minutos: int


class DisponibilidadeDia(ORMModel):
    data: date
    disponivel: bool


class TurmaExperimentalAgendaOut(TurmaExperimentalOut):
    proximas_datas: list[DisponibilidadeDia]


class SolicitacaoExperimentalCriar(ORMModel):
    turma_id: int
    data: date
    nome: str
    email: str
    celular: str
    tem_raquete: bool


class SolicitacaoExperimentalOut(ORMModel):
    id: int
    turma: TurmaExperimentalOut
    point: PointResumo
    data: date
    nome: str
    email: str
    celular: str
    tem_raquete: bool
    status: SolicitacaoExperimentalStatus
    motivo_recusa: str | None
    created_at: datetime
    decidido_em: datetime | None


class SolicitacaoExperimentalRecusa(ORMModel):
    motivo_recusa: str | None = None
