from app.models.enums import ModeloRepasse, VinculoStatus
from app.schemas.common import ORMModel
from app.schemas.point import PointOut
from app.schemas.professor import ProfessorOut


class VinculoCreate(ORMModel):
    """Solicitação de vínculo feita pelo professor autenticado.

    Preço e modelo de repasse aqui são a PROPOSTA do professor; o admin do
    Point pode ajustá-los antes de aprovar (endpoint de aprovação).
    """

    point_id: int
    preco_avulso: float
    preco_plano: float
    modelo_repasse: ModeloRepasse
    valor_repasse: float


class VinculoAprovacao(ORMModel):
    """Permite ao admin ajustar as condições no momento da aprovação."""

    preco_avulso: float | None = None
    preco_plano: float | None = None
    modelo_repasse: ModeloRepasse | None = None
    valor_repasse: float | None = None


class VinculoOut(ORMModel):
    id: int
    professor_id: int
    point_id: int
    preco_avulso: float
    preco_plano: float
    modelo_repasse: ModeloRepasse
    valor_repasse: float
    status: VinculoStatus
    # Lidos via relationship do SQLAlchemy — evita a tela ter que resolver
    # nome do professor/Point a partir de um ID solto.
    professor: ProfessorOut
    point: PointOut
