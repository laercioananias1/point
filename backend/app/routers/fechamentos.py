from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import ModeloRepasse, PagamentoStatus, Role, VinculoStatus
from app.models.fechamento import Fechamento, RepasseFechamento
from app.models.matricula import Matricula
from app.models.pagamento import Pagamento
from app.models.point import Point
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.fechamento import FechamentoCreate, FechamentoOut, RepasseFechamentoOut
from app.services.configuracao import get_ou_criar_configuracao

router = APIRouter(tags=["fechamentos"])


def _to_out(fechamento: Fechamento) -> FechamentoOut:
    return FechamentoOut(
        id=fechamento.id,
        point_id=fechamento.point_id,
        periodo_inicio=fechamento.periodo_inicio,
        periodo_fim=fechamento.periodo_fim,
        taxa_servico_unitaria=fechamento.taxa_servico_unitaria,
        quantidade_pagamentos=fechamento.quantidade_pagamentos,
        total_taxa_servico=fechamento.total_taxa_servico,
        repasses=[
            RepasseFechamentoOut(
                professor_id=r.professor_id, professor_nome=r.professor.nome, valor=r.valor
            )
            for r in fechamento.repasses
        ],
    )


def _autoriza_point(db: Session, point_id: int, user: User) -> Point:
    point = db.get(Point, point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if user.tem_role(Role.ADMIN_POINT) and user.point_id != point_id:
        raise HTTPException(403, "Sem permissão para este Point")
    return point


@router.post("/points/{point_id}/fechamentos", response_model=FechamentoOut, status_code=201)
def gerar_fechamento(
    point_id: int,
    payload: FechamentoCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ADMIN_POINT, Role.SUPER_ADMIN))],
) -> FechamentoOut:
    """Fecha um período (seção 6.3) — na prática dispararia sozinho no 5º dia
    útil via job agendado (seção 7, EventBridge Scheduler); este endpoint é o
    que esse job chamaria, e também dá pra chamar manualmente pra conferir.

    Dois números saem daqui: quanto o Point deve ao SaaS (taxa de serviço, um
    valor fixo por pagamento confirmado — seção 6.2/6.3) e quanto deve
    repassar a cada professor (seção 3.2):

    - percentual / valor_fixo_por_aula: calculado por pagamento confirmado no
      período (usando o pagamento como proxy de "aula dada" — o modelo não
      tem uma entidade Aula/ocorrência separada)
    - valor_fixo_mensal: pago uma vez por vínculo ativo no período, *não* por
      pagamento — é assim que a seção 3.2 descreve ("independente da
      quantidade de aulas ou alunos")

    Simplificação conhecida: se um repasse_override individual usar
    valor_fixo_mensal (caso raro — normalmente essa exceção é percentual ou
    por aula), ele é ignorado aqui; o modelo assume valor_fixo_mensal como
    uma característica do vínculo, não de um aluno específico.
    """
    point = _autoriza_point(db, point_id, user)
    config = get_ou_criar_configuracao(db)

    fim_exclusivo = payload.periodo_fim + timedelta(days=1)
    pagamentos = (
        db.query(Pagamento)
        .join(Matricula, Pagamento.matricula_id == Matricula.id)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Vinculo.point_id == point_id,
            Pagamento.status == PagamentoStatus.CONFIRMADO,
            Pagamento.created_at >= payload.periodo_inicio,
            Pagamento.created_at < fim_exclusivo,
        )
        .all()
    )

    total_taxa = len(pagamentos) * float(config.taxa_servico)
    repasse_por_professor: dict[int, float] = {}

    for pagamento in pagamentos:
        matricula = pagamento.matricula
        vinculo = matricula.turma.vinculo

        if matricula.repasse_override_modelo is not None:
            modelo = matricula.repasse_override_modelo
            valor_regra = float(matricula.repasse_override_valor)
        else:
            modelo = vinculo.modelo_repasse
            valor_regra = float(vinculo.valor_repasse)

        if modelo == ModeloRepasse.PERCENTUAL:
            repasse = float(pagamento.valor) * valor_regra / 100
        elif modelo == ModeloRepasse.VALOR_FIXO_POR_AULA:
            repasse = valor_regra
        else:
            continue  # valor_fixo_mensal é tratado abaixo, por vínculo

        repasse_por_professor[vinculo.professor_id] = (
            repasse_por_professor.get(vinculo.professor_id, 0.0) + repasse
        )

    vinculos_ativos = (
        db.query(Vinculo)
        .filter(Vinculo.point_id == point_id, Vinculo.status == VinculoStatus.ATIVO)
        .all()
    )
    for vinculo in vinculos_ativos:
        if vinculo.modelo_repasse == ModeloRepasse.VALOR_FIXO_MENSAL:
            repasse_por_professor[vinculo.professor_id] = repasse_por_professor.get(
                vinculo.professor_id, 0.0
            ) + float(vinculo.valor_repasse)

    fechamento = Fechamento(
        point_id=point_id,
        periodo_inicio=payload.periodo_inicio,
        periodo_fim=payload.periodo_fim,
        taxa_servico_unitaria=config.taxa_servico,
        quantidade_pagamentos=len(pagamentos),
        total_taxa_servico=total_taxa,
    )
    db.add(fechamento)
    db.flush()  # garante fechamento.id antes de criar os repasses

    for professor_id, valor in repasse_por_professor.items():
        db.add(
            RepasseFechamento(fechamento_id=fechamento.id, professor_id=professor_id, valor=valor)
        )

    db.commit()
    db.refresh(fechamento)
    return _to_out(fechamento)


@router.get("/points/{point_id}/fechamentos", response_model=list[FechamentoOut])
def listar_fechamentos(
    point_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ADMIN_POINT, Role.SUPER_ADMIN))],
) -> list[FechamentoOut]:
    _autoriza_point(db, point_id, user)
    fechamentos = (
        db.query(Fechamento)
        .filter(Fechamento.point_id == point_id)
        .order_by(Fechamento.periodo_inicio.desc())
        .all()
    )
    return [_to_out(f) for f in fechamentos]
