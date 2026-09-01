import calendar
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.assinatura import Assinatura
from app.models.aula import Aula
from app.models.enums import MatriculaStatus
from app.models.matricula import Matricula
from app.models.turma import Turma

# Mesma ordem/valores usados no front (frontend/src/lib/dias.ts) — Python
# date.weekday() já vem 0=segunda..6=domingo, então o índice bate direto.
DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _dia_semana_str(d: date) -> str:
    return DIAS_SEMANA[d.weekday()]


def _ultimo_dia_do_mes(ref: date) -> date:
    ultimo_dia = calendar.monthrange(ref.year, ref.month)[1]
    return date(ref.year, ref.month, ultimo_dia)


def _mes_anterior(mes: date) -> date:
    """`mes` já é o dia 1 de algum mês — devolve o dia 1 do mês anterior."""
    ultimo_dia_mes_anterior = mes - timedelta(days=1)
    return date(ultimo_dia_mes_anterior.year, ultimo_dia_mes_anterior.month, 1)


def matricula_tem_aula_em(matricula: Matricula, data: date) -> bool:
    """Essa matrícula tem mesmo aula na turma dela nessa data específica —
    pedido do usuário, 2026-08-26 (marcar presença): mensal expande
    dias_semana × período (excluindo exceções, da turma e da própria
    matrícula); avulsa é só a data única (data_avulsa/data_inicio_efetiva).
    Mesma checagem usada em vários lugares (reagendar_credito,
    solicitar_matricula), centralizada aqui pra não reescrever de novo."""
    from app.models.enums import MatriculaStatus, MatriculaTipo

    if matricula.status != MatriculaStatus.ATIVA:
        return False

    if matricula.tipo == MatriculaTipo.MENSAL:
        turma = matricula.turma
        if data < matricula.data_inicio_efetiva:
            return False
        if turma.periodo_fim is not None and data > turma.periodo_fim:
            return False
        if _dia_semana_str(data) not in matricula.dias_semana:
            return False
        excluidas = {e.data for e in turma.excecoes_rel} | {e.data for e in matricula.excecoes_rel}
        return data not in excluidas

    return matricula.data_avulsa == data


def matricula_inadimplente(matricula: Matricula, referencia: date | None = None) -> bool:
    """Mensalidade em atraso (pedido do usuário, 2026-08-21: "a data de
    pagamento tem vencimento?" — agora tem, configurável por Point via
    Point.dia_vencimento_mensalidade, padrão dia 10).

    Antes do dia de vencimento deste mês, ainda cobra o mês ANTERIOR (o
    aluno tem até o vencimento pra regularizar); a partir do vencimento
    (inclusive), passa a cobrar o mês CORRENTE. Só vale pra matrícula
    mensal ativa que já estava rodando desde antes do mês cobrado — quem
    entrou nesse mesmo mês ainda não completou um ciclo, não deve nada.
    Usada tanto pra travar a geração de aulas quanto pro badge "em atraso"
    no frontend (Matricula.inadimplente)."""
    from app.models.enums import MatriculaStatus, MatriculaTipo, PagamentoMeio, PagamentoStatus

    if matricula.tipo != MatriculaTipo.MENSAL or matricula.status != MatriculaStatus.ATIVA:
        return False

    # Wellhub/TotalPass não passam pelo fluxo de Pix (pedido do usuário,
    # 2026-09-01) — não existe Pagamento a lançar/confirmar pra um
    # benefício, então nunca fica "em atraso" por essa via. Sem integração
    # nenhuma ainda pra checar de verdade se o benefício segue ativo (fica
    # pra quando existir); por ora, aula continua gerando sempre.
    if matricula.fonte_pagamento != PagamentoMeio.PIX:
        return False

    referencia = referencia or date.today()
    dia_vencimento = matricula.turma.vinculo.point.dia_vencimento_mensalidade
    mes_atual = date(referencia.year, referencia.month, 1)
    mes_cobrado = mes_atual if referencia.day > dia_vencimento else _mes_anterior(mes_atual)

    inicio_mes_matricula = date(
        matricula.data_inicio_efetiva.year, matricula.data_inicio_efetiva.month, 1
    )
    if inicio_mes_matricula >= mes_cobrado:
        return False

    return not any(
        p.status == PagamentoStatus.CONFIRMADO and p.mes_referencia == mes_cobrado
        for p in matricula.pagamentos
    )


def gerar_aulas_do_mes(db: Session, matricula: Matricula, referencia: date | None = None) -> int:
    """Gera as ocorrências (Aula) do mês de `referencia` (padrão: hoje) pra
    uma matrícula mensal — pedido do usuário, 2026-08-19. Idempotente (não
    duplica se já rodou pra esse mês); não faz commit, quem chama decide
    quando fechar a transação (pra poder gerar em lote pra várias matrículas
    numa chamada só).

    Trava pra quem está em atraso (pedido do usuário, 2026-08-21) — não gera
    aula nova do mês pra matrícula que deve o mês anterior; quem já tinha
    aula gerada antes de atrasar não perde (essa função só ADICIONA, nunca
    remove)."""
    referencia = referencia or date.today()
    if matricula_inadimplente(matricula, referencia):
        return 0
    turma = matricula.turma

    inicio_mes = date(referencia.year, referencia.month, 1)
    fim_mes = _ultimo_dia_do_mes(referencia)

    # matricula.data_inicio_efetiva já é o maior entre início da turma e
    # início da assinatura (se houver) — mesma lógica que a agenda do
    # aluno usa no frontend, pra nunca gerar/mostrar aula de antes dele
    # ter entrado (pedido do usuário, 2026-08-21).
    inicio = max(inicio_mes, matricula.data_inicio_efetiva)
    # periodo_fim nulo = turma recorrente sem data de término (2026-08-20) —
    # o teto vira só o fim do mês, igual pra qualquer turma nesse gerador
    # mensal (ele nunca tenta gerar mais de um mês de uma vez).
    fim = fim_mes if turma.periodo_fim is None else min(fim_mes, turma.periodo_fim)
    if inicio > fim:
        return 0

    existentes = {
        a.data
        for a in db.query(Aula).filter(
            Aula.matricula_id == matricula.id, Aula.data >= inicio, Aula.data <= fim
        )
    }
    # Datas removidas (pedido do usuário, 2026-08-20) — a série continua,
    # essa(s) data(s) específica(s) só não geram aula. TurmaExcecao afeta
    # todos os alunos da turma (força maior); MatriculaExcecao é só desse
    # aluno (cancelamento antecipado dele, com crédito).
    excluidas = {e.data for e in turma.excecoes_rel} | {e.data for e in matricula.excecoes_rel}

    novas: list[Aula] = []
    dia_atual = inicio
    while dia_atual <= fim:
        # matricula.dias_semana é o subconjunto que ESSE aluno frequenta
        # dentro da turma (pedido do usuário, 2026-08-21) — não os dias da
        # turma inteira, que pode ter outros alunos com frequência diferente.
        if (
            _dia_semana_str(dia_atual) in matricula.dias_semana
            and dia_atual not in existentes
            and dia_atual not in excluidas
        ):
            novas.append(Aula(matricula_id=matricula.id, data=dia_atual))
        dia_atual += timedelta(days=1)

    db.add_all(novas)
    return len(novas)


def _minutos(horario: str) -> int:
    h, m = horario.split(":")
    return int(h) * 60 + int(m)


def _horarios_se_sobrepoem(h1: str, dur1: int, h2: str, dur2: int) -> bool:
    ini1, fim1 = _minutos(h1), _minutos(h1) + dur1
    ini2, fim2 = _minutos(h2), _minutos(h2) + dur2
    return ini1 < fim2 and ini2 < fim1


def aluno_tem_conflito_horario(
    db: Session,
    aluno_id: int,
    data: date,
    horario: str,
    duracao_minutos: int,
) -> bool:
    """Pra reagendar um crédito de reposição (pedido do usuário, 2026-08-25:
    "não pode ser no mesmo horário que ele já tem aula") — checa se o aluno
    já tem alguma aula ativa, mensal recorrente ou avulsa/reposição já
    marcada, que se sobreponha nessa data. Compara a faixa de horário
    (início + duração) em vez de só o horário de início, porque duas aulas
    com início diferente ainda colidem se uma ainda estiver rolando quando
    a outra começar."""
    from app.models.enums import MatriculaStatus, MatriculaTipo

    dia_semana = _dia_semana_str(data)

    matriculas = (
        db.query(Matricula)
        .join(Turma, Matricula.turma_id == Turma.id)
        .filter(Matricula.aluno_id == aluno_id, Matricula.status == MatriculaStatus.ATIVA)
    )

    for m in matriculas.all():
        turma = m.turma
        if not _horarios_se_sobrepoem(horario, duracao_minutos, turma.horario, turma.duracao_minutos):
            continue
        if m.tipo == MatriculaTipo.MENSAL:
            fora_do_periodo = data < m.data_inicio_efetiva or (
                turma.periodo_fim is not None and data > turma.periodo_fim
            )
            if fora_do_periodo or dia_semana not in m.dias_semana:
                continue
            excluida = {e.data for e in turma.excecoes_rel} | {e.data for e in m.excecoes_rel}
            if data not in excluida:
                return True
        elif m.data_avulsa == data:
            return True
    return False


def gerar_aulas_do_mes_em_lote(
    db: Session, *, point_id: int | None = None, referencia: date | None = None
) -> int:
    """Roda `gerar_aulas_do_mes` pra todas as matrículas mensais ativas com
    assinatura ativa — `point_id=None` cobre a plataforma inteira de uma vez
    (usada pelo job diário automático, ver app/services/scheduler.py);
    `point_id` específico é o que o botão manual do admin ainda chama
    (pedido do usuário, 2026-08-19/21). Idempotente e já resolve sozinho
    quem está em atraso (matricula_inadimplente, dentro de
    gerar_aulas_do_mes) — não precisa filtrar aqui. Comita no final; quem
    chama não precisa se preocupar com transação."""
    query = (
        db.query(Matricula)
        .join(Assinatura, Matricula.assinatura_id == Assinatura.id)
        .filter(Assinatura.status == MatriculaStatus.ATIVA, Matricula.status == MatriculaStatus.ATIVA)
    )
    if point_id is not None:
        query = query.filter(Assinatura.point_id == point_id)

    referencia = referencia or date.today()
    total = sum(gerar_aulas_do_mes(db, m, referencia) for m in query.all())
    db.commit()
    return total
