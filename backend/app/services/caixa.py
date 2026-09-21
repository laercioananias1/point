"""Regras do Caixa do Point (pedido do usuário, 2026-09-20) — entradas
automáticas (cobrança paga, pagamento confirmado do fluxo antigo) e geração
dos lançamentos fixos que se repetem todo mês."""

import calendar
from datetime import date

from sqlalchemy.orm import Session

from app.models.caixa import LancamentoCaixa, LancamentoFixo
from app.models.cobranca import Cobranca
from app.models.enums import LancamentoTipo
from app.models.pagamento import Pagamento


def registrar_entrada_cobranca(db: Session, cobranca: Cobranca) -> None:
    """Cobrança paga vira entrada (sem commit). Idempotente pelo
    origem_cobranca_id único."""
    ja_existe = (
        db.query(LancamentoCaixa.id)
        .filter(LancamentoCaixa.origem_cobranca_id == cobranca.id)
        .first()
    )
    if ja_existe is not None:
        return
    db.add(
        LancamentoCaixa(
            point_id=cobranca.point_id,
            tipo=LancamentoTipo.ENTRADA,
            descricao=f"{cobranca.descricao} — {cobranca.aluno.nome}"[:120],
            valor=cobranca.valor,
            data=cobranca.pago_em or date.today(),
            origem_cobranca_id=cobranca.id,
        )
    )


def remover_entrada_cobranca(db: Session, cobranca: Cobranca) -> None:
    db.query(LancamentoCaixa).filter(LancamentoCaixa.origem_cobranca_id == cobranca.id).delete()


def registrar_entrada_pagamento(db: Session, pagamento: Pagamento) -> None:
    """Pagamento confirmado pelo admin (fluxo antigo de Pix declarado) vira
    entrada (sem commit)."""
    ja_existe = (
        db.query(LancamentoCaixa.id)
        .filter(LancamentoCaixa.origem_pagamento_id == pagamento.id)
        .first()
    )
    if ja_existe is not None:
        return
    matricula = pagamento.matricula
    rotulo = "Pagamento" if pagamento.mes_referencia is None else "Mensalidade"
    db.add(
        LancamentoCaixa(
            point_id=matricula.turma.vinculo.point_id,
            tipo=LancamentoTipo.ENTRADA,
            descricao=f"{rotulo} — {matricula.aluno.nome}"[:120],
            valor=pagamento.valor,
            data=date.today(),
            origem_pagamento_id=pagamento.id,
        )
    )


def remover_entrada_pagamento(db: Session, pagamento: Pagamento) -> None:
    db.query(LancamentoCaixa).filter(LancamentoCaixa.origem_pagamento_id == pagamento.id).delete()


def gerar_lancamentos_fixos(
    db: Session, *, point_id: int | None = None, referencia: date | None = None
) -> int:
    """Cria o lançamento do mês pra cada fixo ativo cujo dia já chegou e
    que ainda não tem um (par fixo+mês único, então rodar todo dia é
    seguro — e recupera sozinho um dia em que o servidor estava fora).
    Comita no final."""
    referencia = referencia or date.today()
    mes = referencia.replace(day=1)

    query = db.query(LancamentoFixo).filter(LancamentoFixo.ativo.is_(True))
    if point_id is not None:
        query = query.filter(LancamentoFixo.point_id == point_id)

    criados = 0
    ultimo_dia = calendar.monthrange(mes.year, mes.month)[1]
    for fixo in query.all():
        # Dia 29-31 num mês mais curto cai no último dia do mês (pedido do
        # usuário, 2026-09-20: "libere, pode tirar a restrição") — comparar
        # com fixo.dia cru faria um fixo no dia 31 nunca sair em abril.
        dia_efetivo = min(fixo.dia, ultimo_dia)
        if referencia.day < dia_efetivo:
            continue
        ja_existe = (
            db.query(LancamentoCaixa.id)
            .filter(LancamentoCaixa.fixo_id == fixo.id, LancamentoCaixa.mes_referencia == mes)
            .first()
        )
        if ja_existe is not None:
            continue
        db.add(
            LancamentoCaixa(
                point_id=fixo.point_id,
                tipo=fixo.tipo,
                descricao=fixo.descricao,
                valor=fixo.valor,
                data=date(mes.year, mes.month, dia_efetivo),
                conta_id=fixo.conta_id,
                fixo_id=fixo.id,
                mes_referencia=mes,
            )
        )
        criados += 1
    db.commit()
    return criados
