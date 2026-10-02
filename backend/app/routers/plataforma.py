"""Painel da plataforma pro dono do app (pedido do usuário, 2026-10-01:
"fazer o início do adm do sistema") — panorama de todos os Points num
lugar só: números do mês, Points sem admin, saúde das integrações nas
últimas 24h e a tabela comparativa. É, junto com /points/ranking, a única
exceção ao isolamento entre Points (seção 3.1) — só SUPER_ADMIN."""

from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.caixa import LancamentoCaixa
from app.models.enums import (
    LancamentoTipo,
    MatriculaStatus,
    Role,
    SolicitacaoExperimentalStatus,
    VinculoStatus,
)
from app.models.integracao_log import IntegracaoLog
from app.models.matricula import Matricula
from app.models.point import Point
from app.models.solicitacao_experimental import SolicitacaoExperimental
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.models.wellhub_checkin import WellhubCheckin
from app.schemas.plataforma import (
    PlataformaAdminOut,
    PlataformaIntegracaoOut,
    PlataformaPainelOut,
    PlataformaPointOut,
    PlataformaTotaisOut,
)

router = APIRouter(prefix="/plataforma", tags=["plataforma"])

INTEGRACOES = ["whatsapp", "email", "wellhub", "totalpass"]


def _mes_anterior(inicio: date) -> date:
    return (inicio - timedelta(days=1)).replace(day=1)


@router.get("/painel", response_model=PlataformaPainelOut)
def painel_plataforma(
    db: Annotated[Session, Depends(get_db)],
    _dono: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> PlataformaPainelOut:
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)
    inicio_ant = _mes_anterior(inicio_mes)
    dt_mes = datetime.combine(inicio_mes, datetime.min.time())

    def recebido(point_id: int | None, inicio: date, fim: date) -> float:
        q = db.query(func.coalesce(func.sum(LancamentoCaixa.valor), 0)).filter(
            LancamentoCaixa.tipo == LancamentoTipo.ENTRADA,
            LancamentoCaixa.data >= inicio,
            LancamentoCaixa.data <= fim,
        )
        if point_id is not None:
            q = q.filter(LancamentoCaixa.point_id == point_id)
        return float(q.scalar())

    # Admins por Point (um usuário admin_point aponta pro Point em point_id).
    admins: dict[int, int] = {}
    admins_lista: dict[int, list[PlataformaAdminOut]] = {}
    for user in db.query(User).filter(User.point_id.isnot(None)).order_by(User.nome).all():
        if user.tem_role(Role.ADMIN_POINT):
            admins[user.point_id] = admins.get(user.point_id, 0) + 1
            admins_lista.setdefault(user.point_id, []).append(
                PlataformaAdminOut(nome=user.nome, email=user.email, celular=user.celular)
            )

    points = []
    alunos_plataforma: set[int] = set()
    professores_plataforma = 0
    for point in db.query(Point).order_by(Point.nome).all():
        alunos = {
            aluno_id
            for (aluno_id,) in db.query(Matricula.aluno_id)
            .join(Turma, Matricula.turma_id == Turma.id)
            .join(Vinculo, Turma.vinculo_id == Vinculo.id)
            .filter(Vinculo.point_id == point.id, Matricula.status == MatriculaStatus.ATIVA)
            .distinct()
        }
        alunos_plataforma |= alunos
        professores = (
            db.query(Vinculo)
            .filter(Vinculo.point_id == point.id, Vinculo.status == VinculoStatus.ATIVO)
            .count()
        )
        professores_plataforma += professores
        turmas = (
            db.query(Turma)
            .join(Vinculo, Turma.vinculo_id == Vinculo.id)
            .filter(
                Vinculo.point_id == point.id,
                Vinculo.status == VinculoStatus.ATIVO,
                (Turma.periodo_fim.is_(None)) | (Turma.periodo_fim >= hoje),
            )
            .count()
        )
        points.append(
            PlataformaPointOut(
                id=point.id,
                nome=point.nome,
                criado_em=point.created_at.date().isoformat(),
                admins=admins.get(point.id, 0),
                admins_lista=admins_lista.get(point.id, []),
                professores=professores,
                alunos=len(alunos),
                turmas=turmas,
                recebido_mes=recebido(point.id, inicio_mes, hoje),
                recebido_mes_anterior=recebido(point.id, inicio_ant, inicio_mes - timedelta(days=1)),
            )
        )

    # Alunos novos no mês: primeira matrícula (em qualquer Point) criada no mês.
    primeiras = (
        db.query(Matricula.aluno_id, func.min(Matricula.created_at))
        .group_by(Matricula.aluno_id)
        .all()
    )
    alunos_novos = sum(1 for _, criada in primeiras if criada >= dt_mes)

    checkins = (
        db.query(func.count(WellhubCheckin.id)).filter(WellhubCheckin.data >= inicio_mes).scalar() or 0
    )
    experimentais = (
        db.query(func.count(SolicitacaoExperimental.id))
        .filter(SolicitacaoExperimental.created_at >= dt_mes)
        .scalar()
        or 0
    )
    experimentais_pendentes = (
        db.query(func.count(SolicitacaoExperimental.id))
        .filter(SolicitacaoExperimental.status == SolicitacaoExperimentalStatus.PENDENTE)
        .scalar()
        or 0
    )

    # Saúde das integrações nas últimas 24h.
    desde = datetime.now() - timedelta(hours=24)
    integracoes = []
    for nome in INTEGRACOES:
        base = db.query(IntegracaoLog).filter(
            IntegracaoLog.integracao == nome, IntegracaoLog.criado_em >= desde
        )
        total = base.count()
        erros = base.filter(IntegracaoLog.sucesso.is_(False)).count()
        ultimo_erro = (
            db.query(IntegracaoLog)
            .filter(IntegracaoLog.integracao == nome, IntegracaoLog.sucesso.is_(False))
            .order_by(IntegracaoLog.criado_em.desc())
            .first()
        )
        integracoes.append(
            PlataformaIntegracaoOut(
                integracao=nome,
                total_24h=total,
                erros_24h=erros,
                ultimo_erro_em=ultimo_erro.criado_em.isoformat() if ultimo_erro else None,
                ultimo_erro=ultimo_erro.mensagem[:160] if ultimo_erro else None,
            )
        )

    return PlataformaPainelOut(
        totais=PlataformaTotaisOut(
            points=len(points),
            points_novos_mes=sum(1 for p in points if p.criado_em >= inicio_mes.isoformat()),
            alunos=len(alunos_plataforma),
            alunos_novos_mes=alunos_novos,
            professores=professores_plataforma,
            recebido_mes=recebido(None, inicio_mes, hoje),
            recebido_mes_anterior=recebido(None, inicio_ant, inicio_mes - timedelta(days=1)),
            checkins_mes=checkins,
            experimentais_mes=experimentais,
            experimentais_pendentes=experimentais_pendentes,
        ),
        points=sorted(points, key=lambda p: (-p.recebido_mes, p.nome)),
        integracoes=integracoes,
    )
