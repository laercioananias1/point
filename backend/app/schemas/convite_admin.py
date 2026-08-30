from datetime import date

from app.models.enums import ConviteStatus
from app.schemas.common import ORMModel
from app.schemas.point import PointResumo


class ConviteAdminCriar(ORMModel):
    """O dono do app decide pra qual Point é — quem recebe só aceita
    (pedido do usuário, 2026-08-26: mesmo padrão de aluno/professor, sem
    o dono do app definir senha por ninguém)."""

    point_id: int
    nome: str
    celular: str
    email: str


class ConviteAdminOut(ORMModel):
    id: int
    token: str
    nome: str
    celular: str
    email: str
    point: PointResumo
    status: ConviteStatus
    expira_em: date
    expirado: bool
    # Calculado na hora — se já existe conta com esse e-mail, a tela de
    # aceite pede login em vez de criar senha nova (e a conta GANHA o
    # papel admin_point, sem perder o que já tinha).
    admin_ja_cadastrado: bool = False


class ConviteAdminAceitarNovo(ORMModel):
    senha: str
