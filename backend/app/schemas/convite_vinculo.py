from datetime import date

from app.models.enums import ConviteStatus
from app.schemas.common import ORMModel
from app.schemas.point import PointResumo


class ConviteVinculoCriar(ORMModel):
    """O admin só informa quem convidar — o professor aceita. Preço de aula
    avulsa/plano é tabela do Point por modalidade, não entra no convite."""

    nome: str
    celular: str
    email: str


class ConviteVinculoOut(ORMModel):
    id: int
    token: str
    nome: str
    celular: str
    email: str
    point: PointResumo
    status: ConviteStatus
    expira_em: date
    expirado: bool
    # Calculado na hora — se já existe conta com esse celular, a tela de
    # aceite pede login em vez de criar senha nova.
    professor_ja_cadastrado: bool = False


class ConviteVinculoAceitarNovo(ORMModel):
    senha: str
