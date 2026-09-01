from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.assinatura import Assinatura
from app.models.aula import Aula
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import CreditoStatus, MatriculaStatus, MatriculaTipo, Role
from app.models.matricula import Matricula
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.assinatura import AssinaturaOut

router = APIRouter(prefix="/assinaturas", tags=["assinaturas"])

# Cadastro de assinatura não tem mais um POST direto aqui — só acontece via
# aceite de Convite (pedido do usuário, 2026-08-20: o aluno cadastra a
# própria conta; o admin manda um convite com a assinatura inteira já
# decidida, e ela ativa sozinha quando o convite é aceito). Ver
# app/routers/convites.py.


@router.get("", response_model=list[AssinaturaOut])
def listar_assinaturas_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Assinatura]:
    return db.query(Assinatura).filter(Assinatura.point_id == admin.point_id).all()


@router.patch("/{assinatura_id}/cancelar", response_model=AssinaturaOut)
def cancelar_assinatura(
    assinatura_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(Role.ALUNO, Role.ADMIN_POINT))],
) -> Assinatura:
    """Desistência — o aluno não quer mais continuar o plano (pedido do
    usuário, 2026-08-19). O admin também pode cancelar em nome do aluno
    (2026-08-20 — agora é ele quem cuida da assinatura de ponta a ponta, faz
    sentido poder encerrar também se o aluno avisar por fora do app). Cancela
    a assinatura e todas as matrículas que vieram dela, o que já é suficiente
    pra geração mensal de aulas parar de gerar (ela só olha matrícula ativa).

    Também apaga as Aula futuras já geradas dessas matrículas e expira os
    créditos de reposição ainda disponíveis vindos delas (pedido do
    usuário, 2026-09-01: "cancelamento de matricula, limpa tudo" / depois
    "cancelamento de assinatura tambem remove os creditos") — sem isso,
    aula do mês corrente já gerada antes do cancelamento ficaria "presa"
    no banco, e um crédito de reposição sobreviveria fazendo o aluno achar
    que ainda pode reagendar uma aula de um plano que ele já cancelou.
    Marca como EXPIRADO em vez de apagar a linha — mantém o histórico
    (mesmo padrão de matrícula/assinatura: status muda, nada é excluído,
    exceto Aula, que é só a ocorrência futura, sem valor de histórico).

    Também cancela outras matrículas AVULSAS futuras desse mesmo aluno
    nesse mesmo Point (pedido do usuário, 2026-09-01: "o cancelamento de
    aulas nao cancela as avulsas?... se to cancelando assinatura, pq
    deixar as avulsas" — avulsa nunca pertence a uma Assinatura, então
    ficava de fora do laço acima mesmo sendo, na prática, o aluno saindo
    do Point de vez). Só as com data futura — uma avulsa de uma aula que
    já aconteceu fica como estava, não é "cancelamento" retroativo."""
    assinatura = db.get(Assinatura, assinatura_id)
    if assinatura is None:
        raise HTTPException(404, "Assinatura não encontrada")
    dono = user.tem_role(Role.ALUNO) and assinatura.aluno_id == user.aluno_id
    do_point = user.tem_role(Role.ADMIN_POINT) and assinatura.point_id == user.point_id
    if not (dono or do_point):
        raise HTTPException(404, "Assinatura não encontrada")
    if assinatura.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível cancelar uma assinatura ativa")

    assinatura.status = MatriculaStatus.CANCELADA
    for matricula in assinatura.matriculas:
        if matricula.status == MatriculaStatus.ATIVA:
            matricula.status = MatriculaStatus.CANCELADA
        db.query(Aula).filter(
            Aula.matricula_id == matricula.id, Aula.data >= date.today()
        ).delete(synchronize_session=False)
        db.query(CreditoReposicao).filter(
            CreditoReposicao.matricula_id == matricula.id,
            CreditoReposicao.status == CreditoStatus.DISPONIVEL,
        ).update({"status": CreditoStatus.EXPIRADO}, synchronize_session=False)

    outras_avulsas = (
        db.query(Matricula)
        .join(Turma, Matricula.turma_id == Turma.id)
        .join(Vinculo, Turma.vinculo_id == Vinculo.id)
        .filter(
            Matricula.aluno_id == assinatura.aluno_id,
            Vinculo.point_id == assinatura.point_id,
            Matricula.tipo == MatriculaTipo.AVULSA,
            Matricula.status == MatriculaStatus.ATIVA,
            Matricula.data_avulsa >= date.today(),
        )
        .all()
    )
    for avulsa in outras_avulsas:
        avulsa.status = MatriculaStatus.CANCELADA

    db.commit()
    db.refresh(assinatura)
    return assinatura


# O antigo POST /assinaturas/points/{point_id}/gerar-aulas-do-mes ("Gerar
# aulas do mês agora", botão manual na tela do Aluno) foi removido (pedido
# do usuário, 2026-08-30: "se for pra ter só quando o aluno regularizar,
# deixa automático nesse momento, e não eu ter que fazer isso manualmente")
# — confirmar_pagamento (app/routers/pagamentos.py) agora chama
# gerar_aulas_do_mes na hora que o pagamento em atraso é confirmado, sem
# precisar de um clique manual depois. A geração diária de madrugada pra
# quem já tava em dia continua normal (app/services/scheduler.py).
