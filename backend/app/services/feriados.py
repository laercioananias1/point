from datetime import date, timedelta
from functools import lru_cache

from sqlalchemy.orm import Session

from app.models.feriado import Feriado

# Feriados nacionais de verdade, por lei federal (pedido do usuário,
# 2026-09-01: "se conseguir já ter os nacionais pré-cadastrados é ótimo")
# — de propósito NÃO inclui Carnaval nem Corpus Christi: são "ponto
# facultativo" nacionalmente, não feriado obrigatório (viram feriado só
# quando um município/estado decreta — isso já é coberto pelo cadastro de
# feriado LOCAL do admin, não precisa forçar aqui). Calculado na hora pra
# qualquer ano, não pré-populado no banco.


def _domingo_de_pascoa(ano: int) -> date:
    """Algoritmo de Gauss (anônimo gregoriano) pra achar a data da Páscoa —
    é o que ancora Sexta-feira Santa, o único feriado nacional móvel."""
    a = ano % 19
    b = ano // 100
    c = ano % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = ((h + l - 7 * m + 114) % 31) + 1
    return date(ano, mes, dia)


@lru_cache(maxsize=None)
def feriados_nacionais_do_ano(ano: int) -> dict[date, str]:
    pascoa = _domingo_de_pascoa(ano)
    return {
        date(ano, 1, 1): "Confraternização Universal",
        pascoa - timedelta(days=2): "Sexta-feira Santa",
        date(ano, 4, 21): "Tiradentes",
        date(ano, 5, 1): "Dia do Trabalho",
        date(ano, 9, 7): "Independência do Brasil",
        date(ano, 10, 12): "Nossa Senhora Aparecida",
        date(ano, 11, 2): "Finados",
        date(ano, 11, 15): "Proclamação da República",
        date(ano, 11, 20): "Dia Nacional de Zumbi e da Consciência Negra",
        date(ano, 12, 25): "Natal",
    }


def feriados_do_periodo(db: Session, point_id: int, inicio: date, fim: date) -> dict[date, str]:
    """Feriados nacionais + locais desse Point, entre `inicio` e `fim`
    (inclusive) — local sobrescreve o nome do nacional se cair no mesmo
    dia (raro, mas evita duplicar sentido)."""
    resultado: dict[date, str] = {}
    for ano in range(inicio.year, fim.year + 1):
        resultado.update(feriados_nacionais_do_ano(ano))

    locais = db.query(Feriado.data, Feriado.nome).filter(
        Feriado.point_id == point_id, Feriado.data >= inicio, Feriado.data <= fim
    )
    for d, nome in locais:
        resultado[d] = nome

    return {d: nome for d, nome in resultado.items() if inicio <= d <= fim}


def eh_feriado(db: Session, point_id: int, data: date) -> str | None:
    """Nome do feriado (nacional ou local) se `data` for feriado desse
    Point, senão None. Usado pra bloquear escolher essa data numa aula
    avulsa/reposição (routers/matriculas.py, routers/creditos.py)."""
    return feriados_do_periodo(db, point_id, data, data).get(data)
