from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import Role, VinculoStatus
from app.models.professor import Professor
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.vinculo import VinculoOut, VinculoSelfCriar

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


@router.post("/self", response_model=VinculoOut, status_code=201)
def virar_professor_do_proprio_point(
    payload: VinculoSelfCriar,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Vinculo:
    """Admin vira professor do próprio Point na hora, sem convite por e-mail
    (pedido do usuário, 2026-09-01: "quero que aciona sem ter que enviar
    convite" — caso comum de Point pequeno onde o dono também dá aula).
    Mesmo desenho de app/routers/convites_vinculo.py::aceitar_convite_vinculo
    (conta existente ganhando o papel professor, criando o Professor na
    hora se ainda não tinha), só que sem convite: reaproveita nome/celular/
    e-mail da própria conta."""
    if admin.professor_id is None:
        professor = Professor(nome=admin.nome, contato=admin.celular, email=admin.email, modalidades=[])
        db.add(professor)
        db.flush()
        admin.professor_id = professor.id

    if not admin.tem_role(Role.PROFESSOR):
        admin.roles = [*admin.roles, Role.PROFESSOR.value]

    vinculo_ativo = (
        db.query(Vinculo)
        .filter(
            Vinculo.professor_id == admin.professor_id,
            Vinculo.point_id == admin.point_id,
            Vinculo.status == VinculoStatus.ATIVO,
        )
        .first()
    )
    if vinculo_ativo is not None:
        raise HTTPException(409, "Você já é professor deste Point")

    vinculo = Vinculo(
        professor_id=admin.professor_id,
        point_id=admin.point_id,
        modelo_repasse=payload.modelo_repasse,
        valor_repasse=payload.valor_repasse,
        status=VinculoStatus.ATIVO,
    )
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    return vinculo
