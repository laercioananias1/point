import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import create_access_token, hash_password
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.convite import Convite
from app.models.convite_dia_escolhido import ConviteDiaEscolhido
from app.models.enums import ConviteStatus, FormaPagamento, PagamentoMeio, Role
from app.models.modalidade import Modalidade
from app.models.plano import Plano
from app.models.turma import Turma
from app.models.user import User
from app.schemas.assinatura import AssinaturaOut
from app.schemas.auth import TokenResponse
from app.schemas.convite import (
    ConviteAceitarNovo,
    ConviteCriar,
    ConviteOut,
    ConviteTurmaEscolhaOut,
)
from app.services.assinaturas import criar_assinatura_ativa, validar_turmas_para_plano
from app.services.email import enviar_convite_email

router = APIRouter(prefix="/convites", tags=["convites"])

PRAZO_EXPIRACAO_DIAS = 7


def _para_out(db: Session, convite: Convite) -> ConviteOut:
    # Só e-mail identifica conta já existente (pedido do usuário, 2026-08-21
    # — celular não trava mais nada, só e-mail é login/único).
    aluno_ja_cadastrado = db.query(User).filter(User.email == convite.email).first() is not None

    dias_por_turma = convite.dias_por_turma()
    turmas_por_id = {t.id: t for t in db.query(Turma).filter(Turma.id.in_(dias_por_turma.keys()))}
    turmas_escolhidas = [
        ConviteTurmaEscolhaOut(turma=turmas_por_id[turma_id], dias_semana=dias)
        for turma_id, dias in dias_por_turma.items()
    ]

    return ConviteOut(
        id=convite.id,
        token=convite.token,
        nome=convite.nome,
        email=convite.email,
        point=convite.point,
        modalidade=convite.modalidade,
        plano=convite.plano,
        turmas=turmas_escolhidas,
        data_inicio=convite.data_inicio,
        status=convite.status,
        expira_em=convite.expira_em,
        expirado=convite.expirado,
        aluno_ja_cadastrado=aluno_ja_cadastrado,
    )


@router.post("", response_model=ConviteOut, status_code=201)
def criar_convite(
    payload: ConviteCriar,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> ConviteOut:
    """Admin decide a assinatura inteira (modalidade, plano, turmas, data
    de início) e convida o aluno por e-mail (pedido do usuário, 2026-08-20
    — o aluno cadastra a própria conta, o admin não cria senha por ele).
    Valida tudo já aqui pra dar erro cedo — revalida de novo no aceite,
    porque turma/plano podem ter mudado nesse meio-tempo."""
    # Dinheiro não é aceito (pedido do usuário, 2026-08-26: "vou retirar do
    # sistema a forma de pagamento em dinheiro"); Wellhub/TotalPass entraram
    # depois (pedido do usuário, 2026-09-01) — só como forma de pagamento
    # da matrícula, sem integração nenhuma ainda (ver PagamentoMeio).
    if payload.fonte_pagamento not in (PagamentoMeio.PIX, PagamentoMeio.WELLHUB, PagamentoMeio.TOTALPASS):
        raise HTTPException(422, "Forma de pagamento não aceita — use Pix, Wellhub ou TotalPass")

    modalidade = db.get(Modalidade, payload.modalidade_id)
    if modalidade is None or modalidade.point_id != admin.point_id:
        raise HTTPException(404, "Modalidade não encontrada neste Point")

    plano = db.get(Plano, payload.plano_id)
    if plano is None or plano.point_id != admin.point_id:
        raise HTTPException(404, "Plano não encontrado neste Point")

    turmas_validadas = validar_turmas_para_plano(
        db,
        point_id=admin.point_id,
        modalidade_id=payload.modalidade_id,
        plano=plano,
        escolhas=[(t.turma_id, t.dias_semana) for t in payload.turmas],
    )

    # Só e-mail identifica duplicidade — celular não trava mais nada
    # (pedido do usuário, 2026-08-21: "trava só em email... é o login de
    # todo mundo"). Se o e-mail já é de uma conta existente, tudo bem: o
    # aceite detecta isso sozinho e pede login em vez de criar senha nova.
    convite_pendente = (
        db.query(Convite)
        .filter(Convite.email == payload.email, Convite.status == ConviteStatus.PENDENTE)
        .first()
    )
    if convite_pendente is not None and not convite_pendente.expirado:
        raise HTTPException(409, "Já existe um convite pendente pra esse e-mail")

    convite = Convite(
        token=secrets.token_urlsafe(24),
        point_id=admin.point_id,
        nome=payload.nome,
        email=payload.email,
        modalidade_id=payload.modalidade_id,
        periodo_dia_desejado=payload.periodo_dia_desejado,
        fonte_pagamento=payload.fonte_pagamento,
        plano_id=plano.id,
        data_inicio=payload.data_inicio,
        status=ConviteStatus.PENDENTE,
        expira_em=date.today() + timedelta(days=PRAZO_EXPIRACAO_DIAS),
    )
    db.add(convite)
    db.flush()  # garante convite.id antes de linkar os dias escolhidos
    for turma, dias in turmas_validadas:
        for dia in dias:
            db.add(ConviteDiaEscolhido(convite_id=convite.id, turma_id=turma.id, dia_semana=dia))
    db.commit()
    db.refresh(convite)

    settings = get_settings()
    link = f"{settings.frontend_url}/convite/{convite.token}"
    enviar_convite_email(
        nome=convite.nome,
        email=convite.email,
        link=link,
        point_nome=convite.point.nome,
        modalidade_nome=modalidade.nome,
        frequencia=plano.frequencia_semanal,
        preco=float(plano.preco),
    )

    return _para_out(db, convite)


@router.get("", response_model=list[ConviteOut])
def listar_convites(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[ConviteOut]:
    convites = (
        db.query(Convite)
        .filter(Convite.point_id == admin.point_id)
        .order_by(Convite.created_at.desc())
        .all()
    )
    return [_para_out(db, c) for c in convites]


@router.patch("/{convite_id}/cancelar", response_model=ConviteOut)
def cancelar_convite(
    convite_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> ConviteOut:
    convite = db.get(Convite, convite_id)
    if convite is None or convite.point_id != admin.point_id:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status != ConviteStatus.PENDENTE:
        raise HTTPException(422, "Esse convite já foi decidido")

    convite.status = ConviteStatus.CANCELADO
    db.commit()
    db.refresh(convite)
    return _para_out(db, convite)


@router.get("/{token}", response_model=ConviteOut)
def ver_convite(token: str, db: Annotated[Session, Depends(get_db)]) -> ConviteOut:
    """Pública (sem login) — é a tela que a pessoa abre a partir do link do
    e-mail, antes de decidir se cria conta ou só faz login."""
    convite = db.query(Convite).filter(Convite.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    return _para_out(db, convite)


def _convite_valido_ou_erro(db: Session, token: str) -> Convite:
    convite = db.query(Convite).filter(Convite.token == token).first()
    if convite is None:
        raise HTTPException(404, "Convite não encontrado")
    if convite.status == ConviteStatus.ACEITO:
        raise HTTPException(422, "Esse convite já foi aceito")
    if convite.status == ConviteStatus.CANCELADO:
        raise HTTPException(422, "Esse convite foi cancelado")
    if convite.expirado:
        raise HTTPException(422, "Esse convite expirou")
    return convite


def _revalidar_e_ativar(db: Session, convite: Convite, aluno_id: int) -> Assinatura:
    turmas_validadas = validar_turmas_para_plano(
        db,
        point_id=convite.point_id,
        modalidade_id=convite.modalidade_id,
        plano=convite.plano,
        escolhas=list(convite.dias_por_turma().items()),
    )
    assinatura = criar_assinatura_ativa(
        db,
        aluno_id=aluno_id,
        point_id=convite.point_id,
        modalidade_id=convite.modalidade_id,
        periodo_dia_desejado=convite.periodo_dia_desejado,
        fonte_pagamento=convite.fonte_pagamento,
        plano=convite.plano,
        escolhas=turmas_validadas,
        data_inicio=convite.data_inicio,
    )
    convite.status = ConviteStatus.ACEITO
    convite.aceito_em = datetime.now(timezone.utc).replace(tzinfo=None)
    convite.assinatura_id = assinatura.id
    return assinatura


@router.post("/{token}/aceitar-novo", response_model=TokenResponse)
def aceitar_convite_novo(
    token: str, payload: ConviteAceitarNovo, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    """Quem recebeu o convite ainda não tem conta — cria Aluno+User na hora
    (nome/e-mail já vieram do convite; celular e senha são escolhidos agora
    pelo próprio aluno — pedido do usuário, 2026-08-26: "tira desse
    cadastro celular") e já ativa a assinatura. Devolve um token pra deixar
    a pessoa logada direto, sem precisar ir pra tela de login separada."""
    convite = _convite_valido_ou_erro(db, token)

    # Só e-mail identifica conta já existente (pedido do usuário, 2026-08-21).
    if db.query(User).filter(User.email == convite.email).first() is not None:
        raise HTTPException(
            409,
            "Esse e-mail já pertence a outra conta — se for você mesmo, peça pro Point cancelar "
            "esse convite e mandar um novo pro e-mail certo, pra você aceitar fazendo login",
        )

    aluno = Aluno(
        nome=convite.nome,
        contato=payload.celular,
        email=convite.email,
        forma_pagamento_preferida=FormaPagamento(convite.fonte_pagamento.value),
    )
    db.add(aluno)
    db.flush()

    user = User(
        nome=convite.nome,
        celular=payload.celular,
        email=convite.email,
        senha_hash=hash_password(payload.senha),
        roles=[Role.ALUNO.value],
        aluno_id=aluno.id,
    )
    db.add(user)
    db.flush()

    _revalidar_e_ativar(db, convite, aluno.id)
    db.commit()
    db.refresh(user)

    token_acesso = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token_acesso, user=user)


@router.post("/{token}/aceitar", response_model=AssinaturaOut)
def aceitar_convite(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    aluno_user: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Assinatura:
    """Quem recebeu o convite já tem conta — só faz login (na tela de
    aceite) e confirma; não precisa criar senha de novo."""
    convite = _convite_valido_ou_erro(db, token)
    assinatura = _revalidar_e_ativar(db, convite, aluno_user.aluno_id)
    db.commit()
    db.refresh(assinatura)
    return assinatura
