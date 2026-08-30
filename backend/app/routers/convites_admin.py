import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import create_access_token, hash_password
from app.models.convite_admin import ConviteAdmin
from app.models.enums import ConviteStatus, MatriculaStatus, Role, VinculoStatus
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.auth import TokenResponse, UserOut
from app.schemas.convite_admin import ConviteAdminAceitarNovo, ConviteAdminCriar, ConviteAdminOut
from app.services.email import enviar_convite_admin_email

router = APIRouter(prefix="/convites-admin", tags=["convites-admin"])

PRAZO_EXPIRACAO_DIAS = 7


def _para_out(db: Session, convite: ConviteAdmin) -> ConviteAdminOut:
    admin_ja_cadastrado = db.query(User).filter(User.email == convite.email).first() is not None
    return ConviteAdminOut(
        id=convite.id,
        token=convite.token,
        nome=convite.nome,
        celular=convite.celular,
        email=convite.email,
        point=convite.point,
        status=convite.status,
        expira_em=convite.expira_em,
        expirado=convite.expirado,
        admin_ja_cadastrado=admin_ja_cadastrado,
    )


@router.post("", response_model=ConviteAdminOut, status_code=201)
def criar_convite_admin(
    payload: ConviteAdminCriar,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConviteAdminOut:
    """Convida alguém pra administrar um Point — mesmo padrão dos convites
    de assinatura (aluno) e vínculo (professor), pedido do usuário,
    2026-08-26: "não quero criar senha de admin". Substitui o antigo
    POST /points/{id}/admins.

    Fica PENDENTE até a pessoa aceitar de verdade (logando, seja criando
    senha nova ou entrando numa conta que já tem) — pedido do usuário,
    2026-08-26. Por isso valida aqui, na criação, se o e-mail já é admin
    de outro Point: sem essa checagem cedo, o convite ficaria pendente
    pra sempre sem ter como ser aceito (o aceite já barra isso — ver
    _ativar —, mas só na hora H; aqui barra antes de nem mandar o
    e-mail)."""
    if db.get(Point, payload.point_id) is None:
        raise HTTPException(404, "Point não encontrado")

    # Pedido do usuário, 2026-08-26: "convite de admin de Point não pode
    # ser enviado para e-mail que já existe no sistema em outro Point" — o
    # modelo atual só permite uma conta administrar UM Point por vez (ver
    # _ativar). Mesmo Point é sempre permitido (reenvio normal, ou o caso
    # do papel híbrido: virar admin do MESMO Point onde já é professor/
    # aluno). Só bloqueia vínculo/matrícula ATIVO num Point DIFERENTE —
    # relação antiga/encerrada em outro Point não impede.
    usuario_existente = db.query(User).filter(User.email == payload.email).first()
    if usuario_existente is not None:
        if usuario_existente.tem_role(Role.ADMIN_POINT) and usuario_existente.point_id != payload.point_id:
            raise HTTPException(
                409, "Esse e-mail já é admin de outro Point — uma conta só administra um Point por vez"
            )
        if usuario_existente.professor_id is not None:
            vinculo_outro_point = (
                db.query(Vinculo)
                .filter(
                    Vinculo.professor_id == usuario_existente.professor_id,
                    Vinculo.point_id != payload.point_id,
                    Vinculo.status == VinculoStatus.ATIVO,
                )
                .first()
            )
            if vinculo_outro_point is not None:
                raise HTTPException(409, "Esse e-mail já é professor de outro Point")
        if usuario_existente.aluno_id is not None:
            matricula_outro_point = (
                db.query(Matricula)
                .join(Turma, Matricula.turma_id == Turma.id)
                .join(Vinculo, Turma.vinculo_id == Vinculo.id)
                .filter(
                    Matricula.aluno_id == usuario_existente.aluno_id,
                    Vinculo.point_id != payload.point_id,
                    Matricula.status == MatriculaStatus.ATIVA,
                )
                .first()
            )
            if matricula_outro_point is not None:
                raise HTTPException(409, "Esse e-mail já é aluno de outro Point")

    convite_pendente = (
        db.query(ConviteAdmin)
        .filter(ConviteAdmin.email == payload.email, ConviteAdmin.status == ConviteStatus.PENDENTE)
        .first()
    )
    if convite_pendente is not None and not convite_pendente.expirado:
        raise HTTPException(409, "Já existe um convite pendente pra esse e-mail")

    convite = ConviteAdmin(
        token=secrets.token_urlsafe(24),
        point_id=payload.point_id,
        nome=payload.nome,
        celular=payload.celular,
        email=payload.email,
        status=ConviteStatus.PENDENTE,
        expira_em=date.today() + timedelta(days=PRAZO_EXPIRACAO_DIAS),
    )
    db.add(convite)
    db.commit()
    db.refresh(convite)

    settings = get_settings()
    link = f"{settings.frontend_url}/convite-admin/{convite.token}"
    enviar_convite_admin_email(
        nome=convite.nome, email=convite.email, link=link, point_nome=convite.point.nome
    )

    return _para_out(db, convite)


@router.get("", response_model=list[ConviteAdminOut])
def listar_convites_admin(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> list[ConviteAdminOut]:
    convites = db.query(ConviteAdmin).order_by(ConviteAdmin.created_at.desc()).all()
    return [_para_out(db, c) for c in convites]


@router.patch("/{convite_id}/cancelar", response_model=ConviteAdminOut)
def cancelar_convite_admin(
    convite_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> ConviteAdminOut:
    convite = db.get(ConviteAdmin, convite_id)
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status != ConviteStatus.PENDENTE:
        raise HTTPException(422, "Esse convite já foi decidido")

    convite.status = ConviteStatus.CANCELADO
    db.commit()
    db.refresh(convite)
    return _para_out(db, convite)


@router.get("/{token}", response_model=ConviteAdminOut)
def ver_convite_admin(token: str, db: Annotated[Session, Depends(get_db)]) -> ConviteAdminOut:
    """Pública (sem login) — tela que a pessoa abre a partir do link do
    e-mail, antes de decidir se cria conta ou só faz login."""
    convite = db.query(ConviteAdmin).filter(ConviteAdmin.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    return _para_out(db, convite)


def _convite_valido_ou_erro(db: Session, token: str) -> ConviteAdmin:
    convite = db.query(ConviteAdmin).filter(ConviteAdmin.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status == ConviteStatus.ACEITO:
        raise HTTPException(422, "Esse convite já foi aceito")
    if convite.status == ConviteStatus.CANCELADO:
        raise HTTPException(422, "Esse convite foi cancelado")
    if convite.expirado:
        raise HTTPException(422, "Esse convite expirou")
    return convite


def _ativar(db: Session, convite: ConviteAdmin, user: User) -> None:
    # Uma conta só administra UM Point no modelo atual (User.point_id é um
    # campo só) — se já é admin de outro Point, não dá pra sobrescrever
    # silenciosamente (pedido do usuário, 2026-08-26: papel híbrido não
    # cobre "admin de dois Points ao mesmo tempo", só "acumula outro
    # papel", ex.: também professor).
    if user.tem_role(Role.ADMIN_POINT) and user.point_id != convite.point_id:
        raise HTTPException(
            409, "Essa conta já administra outro Point — o modelo atual só permite um por conta"
        )

    user.point_id = convite.point_id
    if not user.tem_role(Role.ADMIN_POINT):
        user.roles = [*user.roles, Role.ADMIN_POINT.value]

    convite.status = ConviteStatus.ACEITO
    convite.aceito_em = datetime.now(timezone.utc).replace(tzinfo=None)


@router.post("/{token}/aceitar-novo", response_model=TokenResponse)
def aceitar_convite_admin_novo(
    token: str, payload: ConviteAdminAceitarNovo, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    """Quem recebeu o convite ainda não tem conta — cria a conta na hora
    (só com a senha escolhida; nome/celular/e-mail já vieram do convite) já
    como admin_point desse Point. Devolve um token pra deixar a pessoa
    logada direto."""
    convite = _convite_valido_ou_erro(db, token)

    if db.query(User).filter(User.email == convite.email).first() is not None:
        raise HTTPException(
            409,
            "Esse e-mail já pertence a outra conta — se for você mesmo, peça pro dono do app "
            "cancelar esse convite e mandar um novo, pra você aceitar fazendo login",
        )

    user = User(
        nome=convite.nome,
        celular=convite.celular,
        email=convite.email,
        senha_hash=hash_password(payload.senha),
        roles=[Role.ADMIN_POINT.value],
        point_id=convite.point_id,
    )
    db.add(user)
    db.flush()

    convite.status = ConviteStatus.ACEITO
    convite.aceito_em = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(user)

    token_acesso = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token_acesso, user=user)


@router.post("/{token}/aceitar", response_model=UserOut)
def aceitar_convite_admin(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Quem recebeu o convite já tem conta (com qualquer papel — aluno,
    professor, ou já admin de outro Point) — só faz login e confirma; a
    conta GANHA o papel admin_point sem perder o(s) que já tinha (pedido
    do usuário, 2026-08-26 — mesma ideia do convite de vínculo virar
    professor pra quem já é admin_point)."""
    convite = _convite_valido_ou_erro(db, token)
    _ativar(db, convite, user)
    db.commit()
    db.refresh(user)
    return user
