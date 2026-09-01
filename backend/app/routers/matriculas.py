from datetime import date, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.aula import Aula
from app.models.credito_reposicao import CreditoReposicao
from app.models.enums import (
    CreditoMotivo,
    CreditoStatus,
    MatriculaStatus,
    MatriculaTipo,
    PagamentoMeio,
    Role,
)
from app.models.matricula import Matricula
from app.models.matricula_excecao import MatriculaExcecao
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.credito import CreditoOut
from app.schemas.matricula import MatriculaCreate, MatriculaOut, RepasseOverrideUpdate
from app.services.aulas import DIAS_SEMANA, aluno_tem_conflito_horario
from app.services.email import enviar_lembrete_mensalidade_email

router = APIRouter(prefix="/matriculas", tags=["matriculas"])


def _get_matricula_do_point_do_admin(db: Session, matricula_id: int, admin: User) -> Matricula:
    matricula = (
        db.query(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Matricula.id == matricula_id, Vinculo.point_id == admin.point_id)
        .first()
    )
    if matricula is None:
        raise HTTPException(404, "Matrícula não encontrada")
    return matricula


@router.post("", response_model=MatriculaOut, status_code=201)
def solicitar_matricula(
    payload: MatriculaCreate,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Matricula:
    """Avulsa ativa direto, sem aprovação manual do admin (pedido do
    usuário, 2026-08-26: "acho que isso não faz mais sentido" — a aprovação
    existia pra revisar junto com o pagamento, mas a cobrança de aula
    avulsa saiu do sistema faz algumas mudanças; sem dinheiro envolvido, um
    "em_analise" que só existia pra virar 'aprovado' sempre não protegia
    nada). As validações de verdade (dia da semana real da turma, dentro
    do período, sem colidir com outra aula que o aluno já tenha) já
    acontecem aqui embaixo, iguais às de creditos.py::reagendar_credito —
    o que garantia a integridade da matrícula nunca foi a aprovação manual,
    foi essa validação."""
    # Dinheiro não é aceito (pedido do usuário, 2026-08-26: "vou retirar do
    # sistema a forma de pagamento em dinheiro"); Wellhub/TotalPass entraram
    # depois (pedido do usuário, 2026-09-01) — ver PagamentoMeio. Sem tela
    # pra escolher isso na compra avulsa ainda (ComprarAvulsa.tsx manda só
    # "pix"), mas a validação já aceita pra quando existir.
    if payload.fonte_pagamento not in (PagamentoMeio.PIX, PagamentoMeio.WELLHUB, PagamentoMeio.TOTALPASS):
        raise HTTPException(422, "Forma de pagamento não aceita — use Pix, Wellhub ou TotalPass")

    turma = db.get(Turma, payload.turma_id)
    if turma is None:
        raise HTTPException(404, "Turma não encontrada")

    if payload.tipo == MatriculaTipo.AVULSA:
        if payload.data_aula is None:
            raise HTTPException(422, "Escolha uma data pra essa aula avulsa")

        data_aula = payload.data_aula
        if data_aula < date.today():
            raise HTTPException(422, "Escolha uma data futura")
        if DIAS_SEMANA[data_aula.weekday()] not in turma.dias_semana:
            raise HTTPException(422, "Essa turma não tem aula nesse dia da semana")
        if data_aula < turma.periodo_inicio or (
            turma.periodo_fim is not None and data_aula > turma.periodo_fim
        ):
            raise HTTPException(422, "Essa data está fora do período dessa turma")
        if data_aula in turma.excecoes:
            raise HTTPException(422, "Essa data foi cancelada nessa turma")

        if aluno_tem_conflito_horario(
            db,
            aluno_id=aluno.aluno_id,
            data=data_aula,
            horario=turma.horario,
            duracao_minutos=turma.duracao_minutos,
        ):
            raise HTTPException(409, "Você já tem aula nesse horário nesse dia")

    matricula = Matricula(
        aluno_id=aluno.aluno_id,
        turma_id=payload.turma_id,
        tipo=payload.tipo,
        fonte_pagamento=payload.fonte_pagamento,
        status=MatriculaStatus.ATIVA,
        data_avulsa=payload.data_aula if payload.tipo == MatriculaTipo.AVULSA else None,
    )
    db.add(matricula)
    db.commit()
    db.refresh(matricula)
    return matricula


@router.get("", response_model=list[MatriculaOut])
def listar_matriculas_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[Matricula]:
    return (
        db.query(Matricula)
        .join(Turma)
        .join(Vinculo)
        .filter(Vinculo.point_id == admin.point_id)
        .all()
    )


@router.post("/{matricula_id}/aulas/{data_aula}/cancelar", response_model=CreditoOut, status_code=201)
def cancelar_aula_matricula(
    matricula_id: int,
    data_aula: date,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> CreditoReposicao:
    """Cancelamento antecipado de UMA aula específica (pedido do usuário,
    2026-08-20: "mostra a agenda e faz o fluxo pro aluno cancelar aula com
    antecedência e gerar crédito") — a matrícula/Assinatura continua ativa,
    só essa data vira exceção (MatriculaExcecao, só pra esse aluno — a turma
    continua normal pros outros) e gera crédito de reposição. Só serve pra
    matrícula mensal — avulsa cancela pelo endpoint acima, que encerra a
    matrícula inteira (não tem 'uma aula' pra cancelar à parte). Respeita
    a antecedência mínima configurada no Point (`prazo_cancelamento_horas`,
    padrão 2h — pedido do usuário, 2026-08-21; cada Point pode ajustar o
    seu em PATCH /points/me/configuracoes)."""
    matricula = db.get(Matricula, matricula_id)
    if matricula is None or matricula.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Matrícula não encontrada")
    if matricula.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível cancelar aula de uma matrícula ativa")
    if matricula.tipo != MatriculaTipo.MENSAL:
        raise HTTPException(
            422, "Matrícula avulsa não tem aula avulsa pra cancelar — cancele a matrícula inteira"
        )

    turma = matricula.turma
    # O dia precisa ser um dos que ESSE aluno frequenta na turma (pedido do
    # usuário, 2026-08-21) — a turma pode ter mais dias que outros alunos
    # usam, mas esse aluno só pode cancelar o que é dele.
    if DIAS_SEMANA[data_aula.weekday()] not in matricula.dias_semana:
        raise HTTPException(422, "Você não tem aula nessa turma nesse dia da semana")

    if data_aula < matricula.data_inicio_efetiva or (
        turma.periodo_fim is not None and data_aula > turma.periodo_fim
    ):
        raise HTTPException(422, "Essa data está fora do período da sua matrícula")

    prazo_horas = turma.vinculo.point.prazo_cancelamento_horas
    horario_aula = datetime.combine(data_aula, time.fromisoformat(turma.horario))
    if horario_aula <= datetime.now() + timedelta(hours=prazo_horas):
        raise HTTPException(
            422, f"Esse Point exige pelo menos {prazo_horas}h de antecedência pra cancelar"
        )

    ja_cancelada = (
        db.query(MatriculaExcecao)
        .filter(MatriculaExcecao.matricula_id == matricula.id, MatriculaExcecao.data == data_aula)
        .first()
    )
    if ja_cancelada:
        raise HTTPException(409, "Essa aula já tinha sido cancelada")

    db.add(MatriculaExcecao(matricula_id=matricula.id, data=data_aula))
    db.query(Aula).filter(
        Aula.matricula_id == matricula.id, Aula.data == data_aula
    ).delete(synchronize_session=False)

    prazo_dias = turma.vinculo.point.prazo_credito_dias
    credito = CreditoReposicao(
        matricula_id=matricula.id,
        motivo=CreditoMotivo.CANCELAMENTO_ALUNO,
        data_aula=data_aula,
        data_expiracao=date.today() + timedelta(days=prazo_dias),
        status=CreditoStatus.DISPONIVEL,
    )
    db.add(credito)
    db.commit()
    db.refresh(credito)
    return credito


@router.post("/{matricula_id}/lembrete-pagamento", status_code=204)
def enviar_lembrete_pagamento(
    matricula_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> None:
    """Lembrete manual de mensalidade em aberto (pedido do usuário,
    2026-08-21) — sem job agendado ainda (seção 7), é o admin do Point quem
    decide a hora de mandar."""
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    if matricula.tipo != MatriculaTipo.MENSAL:
        raise HTTPException(422, "Só matrícula mensal tem mensalidade recorrente pra lembrar")
    if matricula.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível lembrar mensalidade de matrícula ativa")
    if matricula.mes_atual_pago:
        raise HTTPException(422, "Esse aluno já pagou a mensalidade deste mês")

    mes_referencia = date.today().replace(day=1)
    enviar_lembrete_mensalidade_email(
        nome=matricula.aluno.nome,
        email=matricula.aluno.email,
        point_nome=matricula.turma.vinculo.point.nome,
        modalidade_nome=matricula.turma.modalidade.nome,
        # Preço vem do Plano da assinatura, não mais de um preço fixo por
        # modalidade (pedido do usuário, 2026-09-01 — ver Matricula.
        # valor_mensalidade). Matrícula mensal ativa sempre tem assinatura
        # com plano; 0 aqui só seria alcançado por um dado inconsistente.
        valor=matricula.valor_mensalidade or 0,
        mes_referencia=mes_referencia.strftime("%m/%Y"),
    )


@router.patch("/{matricula_id}/repasse", response_model=MatriculaOut)
def definir_repasse_excecao(
    matricula_id: int,
    payload: RepasseOverrideUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Matricula:
    """Exceção de repasse por aluno (seção 3.2/4.2) — o admin do Point decide,
    caso a caso; não existe regra automática de 'quem captou o aluno leva
    100%'. Mandar os dois campos null remove a exceção (volta ao padrão do
    Vínculo)."""
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    matricula.repasse_override_modelo = payload.modelo
    matricula.repasse_override_valor = payload.valor
    db.commit()
    db.refresh(matricula)
    return matricula


@router.patch("/{matricula_id}/cancelar", response_model=MatriculaOut)
def cancelar_matricula(
    matricula_id: int,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> Matricula:
    """Cancelamento antecipado pelo próprio aluno — só pra matrícula AVULSA
    (pedido do usuário, 2026-08-21: tirou a permissão do aluno cancelar
    matrícula MENSAL por aqui; pra isso ele usa "Desistir" na assinatura,
    que cancela o plano inteiro de uma vez — `PATCH /assinaturas/{id}/cancelar`).
    Sem checar horário (avulsa não tem uma data futura fixa pra validar
    antecedência contra). Pra cancelar só UMA aula de uma matrícula mensal,
    sem encerrar a matrícula, ver `cancelar_aula_matricula` logo abaixo —
    esse sim valida o prazo (pedido do usuário, 2026-08-20)."""
    matricula = db.get(Matricula, matricula_id)
    if matricula is None or matricula.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Matrícula não encontrada")
    if matricula.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível cancelar uma matrícula ativa")
    if matricula.tipo == MatriculaTipo.MENSAL:
        raise HTTPException(
            422,
            "Pra cancelar um plano mensal, use \"Desistir\" na sua assinatura — cancela o plano "
            "inteiro de uma vez",
        )

    matricula.status = MatriculaStatus.CANCELADA

    prazo_dias = matricula.turma.vinculo.point.prazo_credito_dias
    db.add(
        CreditoReposicao(
            matricula_id=matricula.id,
            motivo=CreditoMotivo.CANCELAMENTO_ALUNO,
            data_aula=date.today(),
            data_expiracao=date.today() + timedelta(days=prazo_dias),
            status=CreditoStatus.DISPONIVEL,
        )
    )

    # Se essa matrícula vinha de uma Assinatura e não sobra nenhuma outra
    # matrícula ativa dela, a assinatura também não faz mais sentido continuar
    # 'ativa' (inconsistência encontrada e corrigida, 2026-08-21 — antes uma
    # Assinatura podia ficar 'ativa' sem nenhuma matrícula ativa por trás,
    # se a última fosse cancelada por aqui em vez de pelo cancelamento da
    # própria Assinatura). Só cancela a Assinatura quando essa era a
    # ÚLTIMA matrícula ativa dela — se ainda sobra outra turma (plano de
    # Nx/semana com mais de 1 turma), a Assinatura continua normal.
    if matricula.assinatura_id is not None:
        outra_ativa = (
            db.query(Matricula)
            .filter(
                Matricula.assinatura_id == matricula.assinatura_id,
                Matricula.id != matricula.id,
                Matricula.status == MatriculaStatus.ATIVA,
            )
            .first()
        )
        if outra_ativa is None:
            matricula.assinatura.status = MatriculaStatus.CANCELADA

    db.commit()
    db.refresh(matricula)
    return matricula
