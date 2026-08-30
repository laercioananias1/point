import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import create_access_token, hash_password
from app.models.convite_vinculo import ConviteVinculo
from app.models.enums import ConviteStatus, Role, VinculoStatus
from app.models.professor import Professor
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.auth import TokenResponse
from app.schemas.convite_vinculo import (
    ConviteVinculoAceitarNovo,
    ConviteVinculoCriar,
    ConviteVinculoOut,
)
from app.schemas.vinculo import VinculoOut
from app.services.email import enviar_convite_vinculo_email

router = APIRouter(prefix="/convites-vinculo", tags=["convites-vinculo"])

PRAZO_EXPIRACAO_DIAS = 7


def _para_out(db: Session, convite: ConviteVinculo) -> ConviteVinculoOut:
    # Só e-mail identifica conta já existente (pedido do usuário, 2026-08-21
    # — celular não trava mais nada, só e-mail é login/único).
    professor_ja_cadastrado = db.query(User).filter(User.email == convite.email).first() is not None
    return ConviteVinculoOut(
        id=convite.id,
        token=convite.token,
        nome=convite.nome,
        celular=convite.celular,
        email=convite.email,
        point=convite.point,
        modelo_repasse=convite.modelo_repasse,
        valor_repasse=convite.valor_repasse,
        status=convite.status,
        expira_em=convite.expira_em,
        expirado=convite.expirado,
        professor_ja_cadastrado=professor_ja_cadastrado,
    )


@router.post("", response_model=ConviteVinculoOut, status_code=201)
def criar_convite_vinculo(
    payload: ConviteVinculoCriar,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> ConviteVinculoOut:
    """Admin decide o acordo de repasse e convida o professor por e-mail
    (pedido do usuário, 2026-08-21 — o professor não solicita mais vínculo;
    preço de aula avulsa/plano é tabela do Point por modalidade, não entra
    aqui)."""
    # Só e-mail identifica duplicidade — celular não trava mais nada
    # (pedido do usuário, 2026-08-21: "trava só em email... é o login de
    # todo mundo"). Se o e-mail já é de uma conta existente, tudo bem: o
    # aceite detecta isso sozinho e pede login em vez de criar senha nova.
    convite_pendente = (
        db.query(ConviteVinculo)
        .filter(ConviteVinculo.email == payload.email, ConviteVinculo.status == ConviteStatus.PENDENTE)
        .first()
    )
    if convite_pendente is not None and not convite_pendente.expirado:
        raise HTTPException(409, "Já existe um convite pendente pra esse e-mail")

    # Pedido do usuário, 2026-08-21: se o professor já faz parte deste Point
    # (vínculo ativo), não faz sentido mandar um novo convite pra ele.
    usuario_existente = db.query(User).filter(User.email == payload.email).first()
    if usuario_existente is not None and usuario_existente.professor_id is not None:
        vinculo_ativo = (
            db.query(Vinculo)
            .filter(
                Vinculo.professor_id == usuario_existente.professor_id,
                Vinculo.point_id == admin.point_id,
                Vinculo.status == VinculoStatus.ATIVO,
            )
            .first()
        )
        if vinculo_ativo is not None:
            raise HTTPException(409, "Esse professor já faz parte deste Point")

    convite = ConviteVinculo(
        token=secrets.token_urlsafe(24),
        point_id=admin.point_id,
        nome=payload.nome,
        celular=payload.celular,
        email=payload.email,
        modelo_repasse=payload.modelo_repasse,
        valor_repasse=payload.valor_repasse,
        status=ConviteStatus.PENDENTE,
        expira_em=date.today() + timedelta(days=PRAZO_EXPIRACAO_DIAS),
    )
    db.add(convite)
    db.commit()
    db.refresh(convite)

    settings = get_settings()
    link = f"{settings.frontend_url}/convite-vinculo/{convite.token}"
    enviar_convite_vinculo_email(
        nome=convite.nome,
        email=convite.email,
        link=link,
        point_nome=convite.point.nome,
        modelo_repasse=convite.modelo_repasse.value,
        valor_repasse=float(convite.valor_repasse),
    )

    return _para_out(db, convite)


@router.get("", response_model=list[ConviteVinculoOut])
def listar_convites_vinculo(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[ConviteVinculoOut]:
    convites = (
        db.query(ConviteVinculo)
        .filter(ConviteVinculo.point_id == admin.point_id)
        .order_by(ConviteVinculo.created_at.desc())
        .all()
    )
    return [_para_out(db, c) for c in convites]


@router.patch("/{convite_id}/cancelar", response_model=ConviteVinculoOut)
def cancelar_convite_vinculo(
    convite_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> ConviteVinculoOut:
    convite = db.get(ConviteVinculo, convite_id)
    if convite is None or convite.point_id != admin.point_id:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status != ConviteStatus.PENDENTE:
        raise HTTPException(422, "Esse convite já foi decidido")

    convite.status = ConviteStatus.CANCELADO
    db.commit()
    db.refresh(convite)
    return _para_out(db, convite)


@router.get("/{token}", response_model=ConviteVinculoOut)
def ver_convite_vinculo(token: str, db: Annotated[Session, Depends(get_db)]) -> ConviteVinculoOut:
    """Pública (sem login) — é a tela que o professor abre a partir do link
    do e-mail, antes de decidir se cria conta ou só faz login."""
    convite = db.query(ConviteVinculo).filter(ConviteVinculo.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    return _para_out(db, convite)


def _convite_valido_ou_erro(db: Session, token: str) -> ConviteVinculo:
    convite = db.query(ConviteVinculo).filter(ConviteVinculo.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status == ConviteStatus.ACEITO:
        raise HTTPException(422, "Esse convite já foi aceito")
    if convite.status == ConviteStatus.CANCELADO:
        raise HTTPException(422, "Esse convite foi cancelado")
    if convite.expirado:
        raise HTTPException(422, "Esse convite expirou")
    return convite


def _ativar(db: Session, convite: ConviteVinculo, professor_id: int) -> Vinculo:
    # Revalida de novo aqui (pedido do usuário, 2026-08-21) — o professor pode
    # ter entrado no Point por outro convite nesse meio-tempo entre a criação
    # deste convite e o aceite.
    vinculo_ativo = (
        db.query(Vinculo)
        .filter(
            Vinculo.professor_id == professor_id,
            Vinculo.point_id == convite.point_id,
            Vinculo.status == VinculoStatus.ATIVO,
        )
        .first()
    )
    if vinculo_ativo is not None:
        raise HTTPException(409, "Esse professor já faz parte deste Point")

    vinculo = Vinculo(
        professor_id=professor_id,
        point_id=convite.point_id,
        modelo_repasse=convite.modelo_repasse,
        valor_repasse=convite.valor_repasse,
        status=VinculoStatus.ATIVO,
    )
    db.add(vinculo)
    db.flush()  # garante vinculo.id antes de linkar no convite

    convite.status = ConviteStatus.ACEITO
    convite.aceito_em = datetime.now(timezone.utc).replace(tzinfo=None)
    convite.vinculo_id = vinculo.id
    return vinculo


@router.post("/{token}/aceitar-novo", response_model=TokenResponse)
def aceitar_convite_vinculo_novo(
    token: str, payload: ConviteVinculoAceitarNovo, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    """Quem recebeu o convite ainda não tem conta — cria Professor+User na
    hora (só com a senha escolhida; nome/celular/e-mail já vieram do
    convite) e já ativa o vínculo. Devolve um token pra deixar a pessoa
    logada direto."""
    convite = _convite_valido_ou_erro(db, token)

    # Só e-mail identifica conta já existente (pedido do usuário, 2026-08-21).
    if db.query(User).filter(User.email == convite.email).first() is not None:
        raise HTTPException(
            409,
            "Esse e-mail já pertence a outra conta — se for você mesmo, peça pro Point cancelar "
            "esse convite e mandar um novo pro celular certo, pra você aceitar fazendo login",
        )

    professor = Professor(nome=convite.nome, contato=convite.celular, email=convite.email, modalidades=[])
    db.add(professor)
    db.flush()

    user = User(
        nome=convite.nome,
        celular=convite.celular,
        email=convite.email,
        senha_hash=hash_password(payload.senha),
        roles=[Role.PROFESSOR.value],
        professor_id=professor.id,
    )
    db.add(user)
    db.flush()

    _ativar(db, convite, professor.id)
    db.commit()
    db.refresh(user)

    token_acesso = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token_acesso, user=user)


@router.post("/{token}/aceitar", response_model=VinculoOut)
def aceitar_convite_vinculo(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.PROFESSOR, Role.ADMIN_POINT))],
) -> Vinculo:
    """Quem recebeu o convite já tem conta — só faz login (na tela de
    aceite) e confirma; não precisa criar senha de novo.

    Também aceita ADMIN_POINT agora (pedido do usuário, 2026-08-26: "o dono
    do Point é também o professor") — se a conta ainda não tinha professor
    vinculado, cria o Professor na hora (com os dados do convite) e a conta
    ganha o papel "professor" além do que já tinha, sem precisar de um
    segundo e-mail/conta."""
    convite = _convite_valido_ou_erro(db, token)

    if user.professor_id is None:
        professor = Professor(
            nome=convite.nome, contato=convite.celular, email=user.email, modalidades=[]
        )
        db.add(professor)
        db.flush()
        user.professor_id = professor.id
        if not user.tem_role(Role.PROFESSOR):
            user.roles = [*user.roles, Role.PROFESSOR.value]

    vinculo = _ativar(db, convite, user.professor_id)
    db.commit()
    db.refresh(vinculo)
    return vinculo
