from app.models.enums import ModeloRepasse, VinculoStatus
from app.schemas.common import ORMModel
from app.schemas.point import PointOut
from app.schemas.professor import ProfessorOut


class VinculoSelfCriar(ORMModel):
    """Admin virando professor do próprio Point (pedido do usuário,
    2026-09-01: "quero que aciona sem ter que enviar convite") — só o
    acordo de repasse; nome/celular/e-mail vêm da própria conta, não tem
    convite nem e-mail envolvido."""

    modelo_repasse: ModeloRepasse
    valor_repasse: float


class VinculoOut(ORMModel):
    id: int
    professor_id: int
    point_id: int
    modelo_repasse: ModeloRepasse
    valor_repasse: float
    status: VinculoStatus
    # Lidos via relationship do SQLAlchemy — evita a tela ter que resolver
    # nome do professor/Point a partir de um ID solto.
    professor: ProfessorOut
    point: PointOut
