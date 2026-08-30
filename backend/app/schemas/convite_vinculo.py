from datetime import date

from app.models.enums import ConviteStatus, ModeloRepasse
from app.schemas.common import ORMModel
from app.schemas.point import PointResumo


class ConviteVinculoCriar(ORMModel):
    """O admin decide o acordo de repasse — o professor só vai aceitar
    (pedido do usuário, 2026-08-21). Preço de aula avulsa/plano é tabela do
    Point por modalidade, não entra no convite."""

    nome: str
    celular: str
    email: str
    modelo_repasse: ModeloRepasse
    valor_repasse: float


class ConviteVinculoOut(ORMModel):
    id: int
    token: str
    nome: str
    celular: str
    email: str
    point: PointResumo
    modelo_repasse: ModeloRepasse
    valor_repasse: float
    status: ConviteStatus
    expira_em: date
    expirado: bool
    # Calculado na hora — se já existe conta com esse celular, a tela de
    # aceite pede login em vez de criar senha nova.
    professor_ja_cadastrado: bool = False


class ConviteVinculoAceitarNovo(ORMModel):
    senha: str
