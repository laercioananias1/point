"""Regras da tela de Cobranças (pedido do usuário, 2026-09-20) — geração
das mensalidades a partir das assinaturas ativas e a ponte com Pagamento,
que é o que o resto do sistema (geração de aulas, "em atraso") ainda lê."""

import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.assinatura import Assinatura
from app.models.cobranca import Cobranca
from app.models.cobranca_lembrete import CobrancaLembrete
from app.models.enums import (
    CobrancaStatus,
    MatriculaStatus,
    MatriculaTipo,
    PagamentoMeio,
    PagamentoStatus,
)
from app.models.pagamento import Pagamento
from app.services.aulas import gerar_aulas_do_mes
from app.services.caixa import (
    registrar_entrada_cobranca,
    remover_entrada_cobranca,
    remover_entrada_pagamento,
)


def _matriculas_da_mensalidade(assinatura: Assinatura):
    return [
        m
        for m in assinatura.matriculas
        if m.tipo == MatriculaTipo.MENSAL and m.status == MatriculaStatus.ATIVA
    ]


def vencimento_do_mes(mes: date, dia_vencimento: int) -> date:
    """Dia de vencimento do Point dentro do mês (fevereiro etc. cai no
    último dia em vez de estourar)."""
    ultimo = calendar.monthrange(mes.year, mes.month)[1]
    return date(mes.year, mes.month, min(dia_vencimento, ultimo))


def _mensalidade_ja_paga(assinatura: Assinatura, mes: date) -> bool:
    matriculas = _matriculas_da_mensalidade(assinatura)
    return bool(matriculas) and all(
        any(
            p.status == PagamentoStatus.CONFIRMADO and p.mes_referencia == mes
            for p in m.pagamentos
        )
        for m in matriculas
    )


def gerar_mensalidades(
    db: Session, *, point_id: int | None = None, referencia: date | None = None
) -> int:
    """Cria a cobrança do mês pra cada assinatura ativa paga por Pix que
    ainda não tem uma — idempotente (o par assinatura+mês é único).
    Wellhub/TotalPass ficam de fora: não existe cobrança a fazer pro aluno
    num benefício (mesma regra de matricula_inadimplente). Se o mês já foi
    pago pelo fluxo antigo de Pagamento, a cobrança nasce já como paga, pra
    não cobrar duas vezes. Comita no final."""
    referencia = referencia or date.today()
    mes = referencia.replace(day=1)

    query = db.query(Assinatura).filter(
        Assinatura.status == MatriculaStatus.ATIVA,
        Assinatura.fonte_pagamento == PagamentoMeio.PIX,
        Assinatura.plano_id.is_not(None),
    )
    if point_id is not None:
        query = query.filter(Assinatura.point_id == point_id)

    criadas = 0
    for assinatura in query.all():
        # Assinatura que só começa em mês futuro não deve nada ainda.
        if assinatura.data_inicio is not None and assinatura.data_inicio > _ultimo_dia(mes):
            continue
        ja_existe = (
            db.query(Cobranca.id)
            .filter(Cobranca.assinatura_id == assinatura.id, Cobranca.mes_referencia == mes)
            .first()
        )
        if ja_existe is not None:
            continue
        paga = _mensalidade_ja_paga(assinatura, mes)
        db.add(
            Cobranca(
                point_id=assinatura.point_id,
                aluno_id=assinatura.aluno_id,
                assinatura_id=assinatura.id,
                descricao=f"Mensalidade {mes.strftime('%m/%Y')}",
                valor=assinatura.plano.preco,
                vencimento=vencimento_do_mes(mes, assinatura.point.dia_vencimento_mensalidade),
                status=CobrancaStatus.PAGA if paga else CobrancaStatus.ABERTA,
                pago_em=date.today() if paga else None,
                mes_referencia=mes,
            )
        )
        criadas += 1
    db.commit()
    return criadas


def _ultimo_dia(mes: date) -> date:
    return mes.replace(day=calendar.monthrange(mes.year, mes.month)[1])


def marcar_paga(db: Session, cobranca: Cobranca) -> None:
    """Marca como paga (sem commit) e lança a entrada no Caixa. Pra mensalidade, grava também os
    Pagamentos confirmados das matrículas da assinatura — o valor da
    cobrança é da assinatura inteira, então é repartido entre as
    matrículas (o resto dos centavos vai pra primeira) pra soma continuar
    batendo com o valor da cobrança — e já gera as aulas
    do mês, igual `confirmar_pagamento` faz."""
    cobranca.status = CobrancaStatus.PAGA
    cobranca.pago_em = date.today()
    registrar_entrada_cobranca(db, cobranca)

    if cobranca.assinatura is None or cobranca.mes_referencia is None:
        return

    matriculas = [
        m
        for m in _matriculas_da_mensalidade(cobranca.assinatura)
        if not any(
            p.status == PagamentoStatus.CONFIRMADO and p.mes_referencia == cobranca.mes_referencia
            for p in m.pagamentos
        )
    ]
    if not matriculas:
        return
    total = Decimal(str(cobranca.valor))
    parte = (total / len(matriculas)).quantize(Decimal("0.01"))
    resto = total - parte * len(matriculas)
    for i, matricula in enumerate(matriculas):
        db.add(
            Pagamento(
                matricula_id=matricula.id,
                valor=parte + (resto if i == 0 else Decimal("0")),
                meio=PagamentoMeio.PIX,
                status=PagamentoStatus.CONFIRMADO,
                mes_referencia=cobranca.mes_referencia,
            )
        )
    db.flush()
    db.expire_all()
    if cobranca.mes_referencia == date.today().replace(day=1):
        for matricula in _matriculas_da_mensalidade(cobranca.assinatura):
            gerar_aulas_do_mes(db, matricula)


def reabrir(db: Session, cobranca: Cobranca) -> None:
    """Desfaz o "Pago" (sem commit) — estorna os Pagamentos que
    `marcar_paga` gravou pro mês, pra o aluno voltar a ficar em atraso se
    for o caso."""
    cobranca.status = CobrancaStatus.ABERTA
    cobranca.pago_em = None
    remover_entrada_cobranca(db, cobranca)
    if cobranca.assinatura is None or cobranca.mes_referencia is None:
        return
    for matricula in _matriculas_da_mensalidade(cobranca.assinatura):
        for p in matricula.pagamentos:
            if p.status == PagamentoStatus.CONFIRMADO and p.mes_referencia == cobranca.mes_referencia:
                p.status = PagamentoStatus.ESTORNADO
                remover_entrada_pagamento(db, p)


# --- Régua de cobrança (pedido do usuário, 2026-10-01: "pode fazer a régua
# de cobrança") — lembretes automáticos por WhatsApp + e-mail em etapas
# fixas em relação ao vencimento. O texto do WhatsApp é o modelo aprovado
# na Meta (o mesmo do botão "Lembrar"), por isso não é editável aqui.

# (dias em relação ao vencimento, título, descrição) — a ordem é a da tela.
ETAPAS_REGUA: list[tuple[int, str, str]] = [
    (-3, "3 dias antes", "Aviso de que a cobrança vence em breve"),
    (0, "No dia do vencimento", "Lembrete no dia de pagar"),
    (3, "3 dias depois", "Primeiro aviso de atraso"),
    (7, "7 dias depois", "Segundo aviso de atraso"),
]
DIAS_ETAPAS = {dias for dias, _, _ in ETAPAS_REGUA}


def etapas_ligadas(point) -> set[int]:
    return {d for d in (point.regua_cobranca or []) if d in DIAS_ETAPAS}


def enviar_lembrete(db: Session, cobranca: Cobranca, *, origem: str, etapa: int | None = None) -> None:
    """WhatsApp + e-mail (mesmo par dos convites) e registro do envio —
    cada canal é fail-soft, então sem credencial configurada só loga (e o
    registro fica, pra régua não tentar a mesma etapa de novo todo dia)."""
    from app.models.point import Point
    from app.services.email import enviar_cobranca_email
    from app.services.whatsapp import enviar_cobranca_whatsapp

    aluno = cobranca.aluno
    point_nome = db.get(Point, cobranca.point_id).nome
    vencimento = cobranca.vencimento.strftime("%d/%m")
    enviar_cobranca_whatsapp(
        celular=aluno.contato,
        nome=aluno.nome,
        point_nome=point_nome,
        descricao=cobranca.descricao,
        valor=f"{float(cobranca.valor):.2f}".replace(".", ","),
        vencimento=vencimento,
        point_id=cobranca.point_id,
    )
    enviar_cobranca_email(
        nome=aluno.nome,
        email=aluno.email,
        point_nome=point_nome,
        descricao=cobranca.descricao,
        valor=float(cobranca.valor),
        vencimento=vencimento,
        point_id=cobranca.point_id,
    )
    db.add(CobrancaLembrete(cobranca_id=cobranca.id, etapa=etapa, origem=origem))


def cobrancas_da_regua_hoje(db: Session, point_id: int, etapas: set[int], hoje: date) -> list[tuple[Cobranca, int]]:
    """Cobranças em aberto do Point que caem numa etapa ligada hoje e ainda
    não receberam essa etapa."""
    if not etapas:
        return []
    abertas = (
        db.query(Cobranca)
        .filter(Cobranca.point_id == point_id, Cobranca.status == CobrancaStatus.ABERTA)
        .all()
    )
    resultado = []
    for cobranca in abertas:
        dias = (hoje - cobranca.vencimento).days
        if dias not in etapas:
            continue
        if any(l.origem == "regua" and l.etapa == dias for l in cobranca.lembretes):
            continue
        resultado.append((cobranca, dias))
    return resultado


def rodar_regua(db: Session, hoje: date | None = None) -> int:
    """Job diário (app/services/scheduler.py) — manda as etapas do dia de
    todos os Points com a régua ligada. Devolve quantos lembretes saíram."""
    from app.models.point import Point

    hoje = hoje or date.today()
    total = 0
    for point in db.query(Point).filter(Point.regua_cobranca.isnot(None)).all():
        for cobranca, dias in cobrancas_da_regua_hoje(db, point.id, etapas_ligadas(point), hoje):
            enviar_lembrete(db, cobranca, origem="regua", etapa=dias)
            total += 1
        db.commit()
    return total
