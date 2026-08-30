from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import Role
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.vinculo import VinculoOut

router = APIRouter(prefix="/vinculos", tags=["vinculos"])

# Não existe mais POST /vinculos nem aprovar/recusar aqui — o professor não
# solicita vínculo (pedido do usuário, 2026-08-21: "quem manda a solicitação
# é o administrador do Point... ficar no mesmo padrão do aluno"). O admin
# convida pelo ConviteVinculo (app/routers/convites_vinculo.py), que já cria
# o Vínculo ATIVO no aceite.


@router.get("", response_model=list[VinculoOut])
def listar_vinculos_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Vinculo]:
    return db.query(Vinculo).filter(Vinculo.point_id == admin.point_id).all()
