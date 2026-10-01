import calendar
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.aluno import Aluno
from app.models.checkin import Checkin
from app.models.enums import CheckinStatus, MatriculaStatus, PagamentoMeio, Role
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.models.wellhub_checkin import WellhubCheckin
from app.schemas.wellhub import (
    WellhubCheckinCreate,
    WellhubCheckinOut,
    CheckinVincular,
    SaldoAlunoOut,
    WellhubReconciliacaoLinha,
    WellhubReconciliacaoOut,
)
from app.services.totalpass import TotalPassError
from app.services.totalpass import validar_checkin as validar_checkin_totalpass
from app.services.wellhub import WellhubError, validar_checkin

router = APIRouter(prefix="/wellhub", tags=["wellhub"])

Admin = Annotated[User, Depends(require_role(Role.ADMIN_POINT))]
DB = Annotated[Session, Depends(get_db)]


def _aluno_do_checkin(db: Session, *, plataforma: str, gympass_id: str, email: str | None) -> int | None:
    """Liga o check-in a um Aluno: pelo Gympass ID já cadastrado (Wellhub)
    ou, se não tiver, pelo e-mail (pedido do usuário, 2026-09-30: "se o
    email do checkin é o mesmo do aluno pode fazer o vinculo automatico").
    Por e-mail só vincula se exatamente um Aluno tiver esse e-mail. Na
    Wellhub também grava o Gympass ID no Aluno e vincula os check-ins
    anteriores dessa pessoa que tinham ficado soltos."""
    if plataforma == "wellhub":
        por_id = db.query(Aluno.id).filter(Aluno.wellhub_gympass_id == gympass_id).first()
        if por_id:
            return por_id[0]

    if not email:
        return None
    candidatos = db.query(Aluno).filter(func.lower(Aluno.email) == email.strip().lower()).limit(2).all()
    if len(candidatos) != 1:
        return None
    aluno = candidatos[0]

    if plataforma == "wellhub" and aluno.wellhub_gympass_id is None:
        aluno.wellhub_gympass_id = gympass_id
        db.query(WellhubCheckin).filter(
            WellhubCheckin.plataforma == "wellhub",
            WellhubCheckin.gympass_id == gympass_id,
            WellhubCheckin.aluno_id.is_(None),
        ).update({WellhubCheckin.aluno_id: aluno.id}, synchronize_session=False)
    return aluno.id


def registrar_checkin(
    db: Session,
    *,
    point_id: int,
    gympass_id: str,
    nome: str | None,
    origem: str,
    data: date | None = None,
    email: str | None = None,
    telefone: str | None = None,
    plataforma: str = "wellhub",
) -> WellhubCheckin:
    """Grava um check-in validado. Só chamar depois de a plataforma validar
    com sucesso — é essa validação que impede contar o mesmo check-in duas
    vezes (a Wellhub recusa com "already validated")."""
    hoje = data or date.today()
    aluno_id = _aluno_do_checkin(db, plataforma=plataforma, gympass_id=gympass_id, email=email)
    checkin = WellhubCheckin(
        point_id=point_id,
        plataforma=plataforma,
        gympass_id=gympass_id,
        aluno_id=aluno_id,
        data=hoje,
        nome_wellhub=nome,
        email_wellhub=email,
        telefone_wellhub=telefone,
        origem=origem,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def _intervalo_do_mes(mes: str | None) -> tuple[date, date]:
    """"YYYY-MM" -> (primeiro dia, último dia) do mês; None = mês
    corrente. Compartilhado entre listagem e reconciliação."""
    if mes:
        try:
            ano, mes_num = (int(p) for p in mes.split("-"))
        except ValueError:
            raise HTTPException(422, "Mês precisa estar no formato YYYY-MM") from None
    else:
        hoje = date.today()
        ano, mes_num = hoje.year, hoje.month
    return date(ano, mes_num, 1), date(ano, mes_num, calendar.monthrange(ano, mes_num)[1])


@router.get("/checkins", response_model=list[WellhubCheckinOut])
def listar_checkins(
    db: DB,
    admin: Admin,
    mes: str | None = None,
    inicio: date | None = None,
    fim: date | None = None,
) -> list[WellhubCheckin]:
    """Check-ins validados desse Point (pedido do usuário, 2026-09-29:
    "tem uma tela dos checkins feitos?") — mais recentes primeiro. Filtra
    por `inicio`/`fim` (datas, inclusive — filtro hoje/semana/mês, pedido
    do usuário, 2026-09-30) ou, sem eles, por `mes` ("YYYY-MM"); padrão o
    mês corrente."""
    if inicio is None or fim is None:
        inicio, fim = _intervalo_do_mes(mes)
    return (
        db.query(WellhubCheckin)
        .filter(
            WellhubCheckin.point_id == admin.point_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .order_by(WellhubCheckin.data.desc(), WellhubCheckin.id.desc())
        .all()
    )


@router.post("/checkins", response_model=WellhubCheckinOut, status_code=201)
def registrar_checkin_manual(payload: WellhubCheckinCreate, db: DB, admin: Admin) -> WellhubCheckin:
    """Check-in manual (pedido do usuário, 2026-09-22) — o admin digita o
    que o aluno mostra no app da plataforma. TotalPass entra aqui do mesmo
    jeito (pedido do usuário, 2026-09-30), sem turma."""
    from app.models.point import Point

    point = db.get(Point, admin.point_id)
    if payload.plataforma == "totalpass":
        if point is None or not point.place_api_key:
            raise HTTPException(
                422, "Esse Point ainda não tem a credencial TotalPass configurada (Configurações)"
            )
        try:
            # A chamada em si já loga sucesso/erro — ver services/totalpass.py.
            beneficiario = validar_checkin_totalpass(
                point_id=point.id, place_api_key=point.place_api_key, codigo=payload.gympass_id
            )
        except TotalPassError as erro:
            raise HTTPException(422, str(erro)) from erro
        return registrar_checkin(
            db,
            point_id=point.id,
            gympass_id=beneficiario.get("documento") or payload.gympass_id,
            nome=beneficiario.get("nome"),
            origem="manual",
            plataforma="totalpass",
        )

    if point is None or not point.wellhub_gym_id:
        raise HTTPException(
            422, "Esse Point ainda não tem o Gym ID da Wellhub configurado (Configurações)"
        )

    try:
        # A chamada em si (evento "validate") já loga sucesso/erro sozinha
        # — ver services/wellhub.py.
        beneficiario = validar_checkin(
            gym_id=point.wellhub_gym_id, gympass_id=payload.gympass_id, point_id=point.id
        )
    except WellhubError as erro:
        raise HTTPException(422, str(erro)) from erro

    return registrar_checkin(
        db,
        point_id=point.id,
        gympass_id=payload.gympass_id,
        nome=beneficiario.get("nome"),
        origem="manual",
    )


@router.patch("/vinculo", status_code=204)
def vincular_pessoa_a_aluno(payload: CheckinVincular, db: DB, admin: Admin) -> None:
    """Vínculo manual quando o automático (Gympass ID ou e-mail) não achou
    o aluno (pedido do usuário, 2026-09-30) — por pessoa, não por check-in
    ("o email é o mesmo sempre"): liga todos os check-ins soltos dela na
    plataforma. Na Wellhub grava o Gympass ID no Aluno, pros próximos já
    chegarem vinculados."""
    tem_checkin_no_point = (
        db.query(WellhubCheckin.id)
        .filter(
            WellhubCheckin.point_id == admin.point_id,
            WellhubCheckin.plataforma == payload.plataforma,
            WellhubCheckin.gympass_id == payload.gympass_id,
        )
        .first()
    )
    if tem_checkin_no_point is None:
        raise HTTPException(404, "Nenhum check-in dessa pessoa nesse Point")
    aluno = db.get(Aluno, payload.aluno_id)
    if aluno is None:
        raise HTTPException(404, "Aluno não encontrado")

    if payload.plataforma == "wellhub":
        if aluno.wellhub_gympass_id not in (None, payload.gympass_id):
            raise HTTPException(
                409, f"Esse aluno já está ligado a outro Gympass ID ({aluno.wellhub_gympass_id})"
            )
        outro = (
            db.query(Aluno.nome)
            .filter(Aluno.wellhub_gympass_id == payload.gympass_id, Aluno.id != aluno.id)
            .first()
        )
        if outro is not None:
            raise HTTPException(409, f"Esse Gympass ID já está ligado a outro aluno ({outro[0]})")
        aluno.wellhub_gympass_id = payload.gympass_id

    db.query(WellhubCheckin).filter(
        WellhubCheckin.plataforma == payload.plataforma,
        WellhubCheckin.gympass_id == payload.gympass_id,
        WellhubCheckin.aluno_id.is_(None),
    ).update({WellhubCheckin.aluno_id: aluno.id}, synchronize_session=False)
    db.commit()


_PLATAFORMA_DO_MEIO = {PagamentoMeio.WELLHUB: "wellhub", PagamentoMeio.TOTALPASS: "totalpass"}


@router.get("/reconciliacao", response_model=WellhubReconciliacaoOut)
def reconciliacao_do_mes(db: DB, admin: Admin, mes: str | None = None) -> WellhubReconciliacaoOut:
    """"Acerto do mês" (pedido do usuário, 2026-09-29: "trabalhar com
    saldos de checkin e qtde aulas feitas, pra ter um acerto no final do
    mes") — por pessoa e plataforma: check-ins validados x aulas de fato
    frequentadas (presença confirmada em matrícula paga por aquela
    plataforma). Saldo = check-ins - aulas; negativo = o aluno precisa
    fazer mais check-in (pedido do usuário, 2026-09-30). Só quantidade:
    a data do check-in não precisa bater com a da aula. Informativo, não
    trava nada.
    `mes` no formato "YYYY-MM"; padrão o mês corrente."""
    inicio, fim = _intervalo_do_mes(mes)
    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fim_dt = datetime.combine(fim, datetime.max.time())

    checkins = (
        db.query(WellhubCheckin)
        .filter(
            WellhubCheckin.point_id == admin.point_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .all()
    )
    # Pessoa = (plataforma, identificador na plataforma).
    checkins_da_pessoa: dict[tuple[str, str], int] = {}
    aluno_da_pessoa: dict[tuple[str, str], int] = {}
    for c in checkins:
        chave = (c.plataforma, c.gympass_id)
        checkins_da_pessoa[chave] = checkins_da_pessoa.get(chave, 0) + 1
        if c.aluno_id is not None:
            aluno_da_pessoa[chave] = c.aluno_id

    aulas = (
        db.query(Matricula.aluno_id, Matricula.fonte_pagamento, func.count(Checkin.id))
        .join(Checkin, Checkin.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == admin.point_id,
            Matricula.fonte_pagamento.in_(list(_PLATAFORMA_DO_MEIO)),
            Checkin.status == CheckinStatus.CONFIRMADO,
            Checkin.data_hora >= inicio_dt,
            Checkin.data_hora <= fim_dt,
        )
        .group_by(Matricula.aluno_id, Matricula.fonte_pagamento)
        .all()
    )
    aulas_do_aluno: dict[tuple[int, str], int] = {
        (aluno_id, _PLATAFORMA_DO_MEIO[fonte]): qtd for aluno_id, fonte, qtd in aulas
    }

    aluno_ids = set(aluno_da_pessoa.values()) | {aluno_id for aluno_id, _ in aulas_do_aluno}
    alunos = {a.id: a for a in db.query(Aluno).filter(Aluno.id.in_(aluno_ids)).all()} if aluno_ids else {}

    def _linha(plataforma, gympass_id, aluno_id, qtd_checkins, qtd_aulas) -> WellhubReconciliacaoLinha:
        aluno = alunos.get(aluno_id) if aluno_id else None
        return WellhubReconciliacaoLinha(
            plataforma=plataforma,
            gympass_id=gympass_id,
            aluno_id=aluno_id,
            aluno_nome=aluno.nome if aluno else None,
            checkins_no_mes=qtd_checkins,
            aulas_no_mes=qtd_aulas,
            saldo=qtd_checkins - qtd_aulas,
        )

    linhas: list[WellhubReconciliacaoLinha] = []
    aulas_ja_contadas: set[tuple[int, str]] = set()
    for (plataforma, gympass_id), qtd_checkins in checkins_da_pessoa.items():
        aluno_id = aluno_da_pessoa.get((plataforma, gympass_id))
        qtd_aulas = 0
        if aluno_id is not None and (aluno_id, plataforma) not in aulas_ja_contadas:
            qtd_aulas = aulas_do_aluno.get((aluno_id, plataforma), 0)
            aulas_ja_contadas.add((aluno_id, plataforma))
        linhas.append(_linha(plataforma, gympass_id, aluno_id, qtd_checkins, qtd_aulas))

    # Aluno que frequentou aula paga pela plataforma mas não teve check-in
    # nenhum no mês — o caso mais importante de não esconder.
    for (aluno_id, plataforma), qtd_aulas in aulas_do_aluno.items():
        if (aluno_id, plataforma) in aulas_ja_contadas:
            continue
        aluno = alunos.get(aluno_id)
        gympass_id = aluno.wellhub_gympass_id if aluno and plataforma == "wellhub" else None
        linhas.append(_linha(plataforma, gympass_id, aluno_id, 0, qtd_aulas))

    linhas.sort(key=lambda linha: (linha.saldo, linha.aluno_nome or linha.gympass_id or ""))
    return WellhubReconciliacaoOut(mes=f"{inicio.year:04d}-{inicio.month:02d}", linhas=linhas)


@router.get("/meu-saldo", response_model=list[SaldoAlunoOut])
def meu_saldo_de_checkins(
    db: DB,
    user: Annotated[User, Depends(require_role(Role.ALUNO))],
    mes: str | None = None,
) -> list[SaldoAlunoOut]:
    """Mesma conta do acerto do mês do admin (só quantidade, sem casar data
    de check-in com data de aula), mas do aluno logado. Inclui matrícula
    ativa paga por benefício mesmo sem movimento no mês, pra o saldo
    aparecer zerado desde o dia 1."""
    inicio, fim = _intervalo_do_mes(mes)
    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fim_dt = datetime.combine(fim, datetime.max.time())
    aluno_id = user.aluno_id

    checkins = dict(
        (((point_id, plataforma), qtd))
        for point_id, plataforma, qtd in db.query(
            WellhubCheckin.point_id, WellhubCheckin.plataforma, func.count(WellhubCheckin.id)
        )
        .filter(
            WellhubCheckin.aluno_id == aluno_id,
            WellhubCheckin.data >= inicio,
            WellhubCheckin.data <= fim,
        )
        .group_by(WellhubCheckin.point_id, WellhubCheckin.plataforma)
        .all()
    )

    aulas = {
        (point_id, _PLATAFORMA_DO_MEIO[fonte]): qtd
        for point_id, fonte, qtd in db.query(Vinculo.point_id, Matricula.fonte_pagamento, func.count(Checkin.id))
        .join(Checkin, Checkin.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Matricula.aluno_id == aluno_id,
            Matricula.fonte_pagamento.in_(list(_PLATAFORMA_DO_MEIO)),
            Checkin.status == CheckinStatus.CONFIRMADO,
            Checkin.data_hora >= inicio_dt,
            Checkin.data_hora <= fim_dt,
        )
        .group_by(Vinculo.point_id, Matricula.fonte_pagamento)
        .all()
    }

    ativas = {
        (point_id, _PLATAFORMA_DO_MEIO[fonte])
        for point_id, fonte in db.query(Vinculo.point_id, Matricula.fonte_pagamento)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Matricula.aluno_id == aluno_id,
            Matricula.status == MatriculaStatus.ATIVA,
            Matricula.fonte_pagamento.in_(list(_PLATAFORMA_DO_MEIO)),
        )
        .distinct()
        .all()
    }

    chaves = set(checkins) | set(aulas) | ativas
    if not chaves:
        return []
    nomes = dict(db.query(Point.id, Point.nome).filter(Point.id.in_({p for p, _ in chaves})).all())
    return sorted(
        (
            SaldoAlunoOut(
                point_id=point_id,
                point_nome=nomes.get(point_id, ""),
                plataforma=plataforma,
                checkins=checkins.get((point_id, plataforma), 0),
                aulas=aulas.get((point_id, plataforma), 0),
                saldo=checkins.get((point_id, plataforma), 0) - aulas.get((point_id, plataforma), 0),
            )
            for point_id, plataforma in chaves
        ),
        key=lambda s: (s.point_nome, s.plataforma),
    )
