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
from app.schemas.matricula import (
    AulaCanceladaOut,
    CancelarAulaAdminRequest,
    MatriculaCreate,
    MatriculaOut,
    PausarAgendaOut,
    PausarAgendaRequest,
    RepasseOverrideUpdate,
)
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


def _cancelar_aula(
    db: Session, matricula: Matricula, data_aula: date, *, gerar_credito: bool, ignorar_prazo: bool
) -> CreditoReposicao | None:
    """Núcleo compartilhado do cancelamento de UMA aula específica (pedido
    do usuário, 2026-08-20) — usado tanto pelo aluno cancelando a própria
    aula (sempre com crédito, sempre respeitando o prazo) quanto pelo admin
    ajustando a agenda por ele (pedido do usuário, 2026-09-01: "editar as
    aulas, remover... fazer ajustes na agenda do aluno" — crédito
    opcional, prazo ignorado, ver os dois `cancelar_aula_matricula*`
    abaixo)."""
    if matricula.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível cancelar aula de uma matrícula ativa")
    if matricula.tipo != MatriculaTipo.MENSAL:
        raise HTTPException(
            422, "Matrícula avulsa não tem aula avulsa pra cancelar — cancele a matrícula inteira"
        )

    turma = matricula.turma
    # O dia precisa ser um dos que ESSE aluno frequenta na turma (pedido do
    # usuário, 2026-08-21) — a turma pode ter mais dias que outros alunos
    # usam, mas só pode cancelar o que é dessa matrícula.
    if DIAS_SEMANA[data_aula.weekday()] not in matricula.dias_semana:
        raise HTTPException(422, "Não há aula nessa turma nesse dia da semana pra essa matrícula")

    if data_aula < matricula.data_inicio_efetiva or (
        turma.periodo_fim is not None and data_aula > turma.periodo_fim
    ):
        raise HTTPException(422, "Essa data está fora do período da matrícula")

    if not ignorar_prazo:
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

    if not gerar_credito:
        return None

    prazo_dias = turma.vinculo.point.prazo_credito_dias
    credito = CreditoReposicao(
        matricula_id=matricula.id,
        motivo=CreditoMotivo.CANCELAMENTO_ALUNO,
        data_aula=data_aula,
        data_expiracao=date.today() + timedelta(days=prazo_dias),
        status=CreditoStatus.DISPONIVEL,
    )
    db.add(credito)
    return credito


@router.post("/{matricula_id}/aulas/{data_aula}/cancelar", response_model=CreditoOut, status_code=201)
def cancelar_aula_matricula(
    matricula_id: int,
    data_aula: date,
    db: Annotated[Session, Depends(get_db)],
    aluno: Annotated[User, Depends(require_role(Role.ALUNO))],
) -> CreditoReposicao:
    """Cancelamento antecipado de UMA aula específica pelo próprio aluno
    (pedido do usuário, 2026-08-20: "mostra a agenda e faz o fluxo pro
    aluno cancelar aula com antecedência e gerar crédito") — a matrícula/
    Assinatura continua ativa, só essa data vira exceção (MatriculaExcecao,
    só pra esse aluno — a turma continua normal pros outros) e sempre gera
    crédito de reposição. Respeita a antecedência mínima configurada no
    Point (`prazo_cancelamento_horas`, padrão 2h — pedido do usuário,
    2026-08-21)."""
    matricula = db.get(Matricula, matricula_id)
    if matricula is None or matricula.aluno_id != aluno.aluno_id:
        raise HTTPException(404, "Matrícula não encontrada")

    credito = _cancelar_aula(db, matricula, data_aula, gerar_credito=True, ignorar_prazo=False)
    db.commit()
    db.refresh(credito)
    return credito


@router.post(
    "/{matricula_id}/aulas/{data_aula}/cancelar-admin", response_model=AulaCanceladaOut, status_code=201
)
def cancelar_aula_matricula_admin(
    matricula_id: int,
    data_aula: date,
    payload: CancelarAulaAdminRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> AulaCanceladaOut:
    """Admin fazendo ajuste na agenda de um aluno (pedido do usuário,
    2026-09-01: "permitir editar as aulas, remover... fazer ajustes na
    agenda do aluno" — normalmente por telefone/presencial, quando o aluno
    pede pro Point resolver). Duas diferenças do cancelamento que o próprio
    aluno faz: ignora o prazo mínimo de antecedência (pedido do usuário —
    "faz sentido o admin resolver uma exceção mesmo em cima da hora") e o
    crédito é opcional (pedido do usuário — "pode ser q o cadastro de
    aulas esteja errado e vai fazer um novo", nesse caso não é uma aula de
    verdade perdida)."""
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    credito = _cancelar_aula(
        db, matricula, data_aula, gerar_credito=payload.gerar_credito, ignorar_prazo=True
    )
    db.commit()
    if credito is not None:
        db.refresh(credito)
    return AulaCanceladaOut(credito=credito)


@router.post("/{matricula_id}/aulas/pausar", response_model=PausarAgendaOut, status_code=201)
def pausar_aulas_matricula(
    matricula_id: int,
    payload: PausarAgendaRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> PausarAgendaOut:
    """Cancela de uma vez todas as ocorrências de uma matrícula mensal
    dentro de um período (pedido do usuário, 2026-09-01: "falta alguma
    coisa que cancele as datas futuras de uma vez" — depois esclarecido:
    "ter opcao de pausar um periodo... o aluno volta depois normalmente",
    diferente de cancelar a matrícula/assinatura de vez). Fora do período
    escolhido, a matrícula continua ativa e gerando aula sozinha — não
    precisa "reativar" nada quando a pausa acaba.

    Só afeta dias que já teriam aula de verdade pra essa matrícula (dia da
    semana bate, dentro do período da turma, ainda não cancelado) — os
    outros dias do intervalo são ignorados silenciosamente, não é erro."""
    matricula = _get_matricula_do_point_do_admin(db, matricula_id, admin)
    if matricula.status != MatriculaStatus.ATIVA:
        raise HTTPException(422, "Só é possível pausar aulas de uma matrícula ativa")
    if matricula.tipo != MatriculaTipo.MENSAL:
        raise HTTPException(422, "Só matrícula mensal tem aulas recorrentes pra pausar")
    if payload.data_fim < payload.data_inicio:
        raise HTTPException(422, "A data final precisa ser igual ou depois da data inicial")

    turma = matricula.turma
    datas_ja_canceladas = {
        e.data
        for e in db.query(MatriculaExcecao).filter(MatriculaExcecao.matricula_id == matricula.id)
    }

    datas_canceladas: list[date] = []
    creditos_gerados = 0
    data_atual = payload.data_inicio
    while data_atual <= payload.data_fim:
        dentro_do_periodo = data_atual >= matricula.data_inicio_efetiva and (
            turma.periodo_fim is None or data_atual <= turma.periodo_fim
        )
        if (
            DIAS_SEMANA[data_atual.weekday()] in matricula.dias_semana
            and dentro_do_periodo
            and data_atual not in datas_ja_canceladas
        ):
            credito = _cancelar_aula(
                db, matricula, data_atual, gerar_credito=payload.gerar_credito, ignorar_prazo=True
            )
            datas_canceladas.append(data_atual)
            if credito is not None:
                creditos_gerados += 1
        data_atual += timedelta(days=1)

    db.commit()
    return PausarAgendaOut(datas_canceladas=datas_canceladas, creditos_gerados=creditos_gerados)


@router.get("/creditos", response_model=list[CreditoOut])
def listar_creditos_do_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> list[CreditoReposicao]:
    """Créditos de reposição de qualquer aluno do Point, em qualquer status
    (pedido do usuário, 2026-09-01: agenda do aluno pro admin precisa
    mostrar os créditos disponíveis, pra poder reagendar por ele) — mesmo
    padrão de GET /matriculas: devolve tudo do Point, o frontend filtra
    por aluno na tela."""
    return (
        db.query(CreditoReposicao)
        .join(Matricula, CreditoReposicao.matricula_id == Matricula.id)
        .join(Turma)
        .join(Vinculo)
        .filter(Vinculo.point_id == admin.point_id)
        .all()
    )


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
