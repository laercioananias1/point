from app.models.enums import ModeloRepasse, VinculoStatus
from app.schemas.common import ORMModel
from app.schemas.point import PointOut
from app.schemas.professor import ProfessorOut


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
