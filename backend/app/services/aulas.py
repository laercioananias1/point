import calendar
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.aula import Aula
from app.models.matricula import Matricula

# Mesma ordem/valores usados no front (frontend/src/lib/dias.ts) — Python
# date.weekday() já vem 0=segunda..6=domingo, então o índice bate direto.
DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _dia_semana_str(d: date) -> str:
    return DIAS_SEMANA[d.weekday()]


def _ultimo_dia_do_mes(ref: date) -> date:
    ultimo_dia = calendar.monthrange(ref.year, ref.month)[1]
    return date(ref.year, ref.month, ultimo_dia)


def gerar_aulas_do_mes(db: Session, matricula: Matricula, referencia: date | None = None) -> int:
    """Gera as ocorrências (Aula) do mês de `referencia` (padrão: hoje) pra
    uma matrícula mensal — pedido do usuário, 2026-08-19. Idempotente (não
    duplica se já rodou pra esse mês); não faz commit, quem chama decide
    quando fechar a transação (pra poder gerar em lote pra várias matrículas
    numa chamada só)."""
    referencia = referencia or date.today()
    turma = matricula.turma
    assinatura = matricula.assinatura

    inicio_mes = date(referencia.year, referencia.month, 1)
    fim_mes = _ultimo_dia_do_mes(referencia)

    limite_inicio = turma.periodo_inicio
    if assinatura and assinatura.data_inicio and assinatura.data_inicio > limite_inicio:
        limite_inicio = assinatura.data_inicio

    inicio = max(inicio_mes, limite_inicio)
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
    # essa(s) data(s) específica(s) só não geram aula.
    excluidas = {e.data for e in turma.excecoes_rel}

    novas: list[Aula] = []
    dia_atual = inicio
    while dia_atual <= fim:
        if (
            _dia_semana_str(dia_atual) == turma.dia_semana
            and dia_atual not in existentes
            and dia_atual not in excluidas
        ):
            novas.append(Aula(matricula_id=matricula.id, data=dia_atual))
        dia_atual += timedelta(days=1)

    db.add_all(novas)
    return len(novas)
