"""Pix de uma cobrança pelo gateway do Point (pedido do usuário,
2026-10-02: "desenvolver api do mercado pago para pagto com pix").

Fluxo: alguém abre o pagamento (/pagar/<token>, pelo app do aluno ou pelo
link do e-mail/WhatsApp) -> `garantir_pix` cria o Pix na conta do Point
(ou reaproveita o que ainda vale) -> o aluno paga -> o gateway avisa pelo
webhook, ou a própria tela pergunta (`conferir_pix`) -> a cobrança vira
paga do mesmo jeito que o "marcar paga" do admin (entrada no Caixa,
Pagamentos da mensalidade, geração das aulas)."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.cobranca import Cobranca
from app.models.enums import CobrancaStatus
from app.models.point import Point
from app.services import cobrancas as servico_cobrancas
from app.services.gateways import GatewayErro, PagamentoConsultado, gateway

# Validade de cada Pix gerado — depois disso a tela gera outro sozinha.
VALIDADE_PIX = timedelta(hours=24)
# Pix que vence em menos que isso é trocado por um novo antes de mostrar.
FOLGA_MINIMA = timedelta(minutes=10)


def pagamento_online_ativo(point: Point | None) -> bool:
    return bool(point and point.pagamento_credencial and gateway(point.pagamento_gateway))


def link_pagamento(cobranca: Cobranca) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/pagar/{cobranca.pagamento_token}"


def _notificacao_url(point: Point) -> str | None:
    base = get_settings().api_public_url.rstrip("/")
    if not base:
        return None
    return f"{base}/webhooks/{point.pagamento_gateway}?point_id={point.id}"


def garantir_pix(db: Session, cobranca: Cobranca) -> Cobranca:
    """Deixa a cobrança com um Pix válido (sem commit). Levanta
    GatewayErro se o Point não tem pagamento online ou o gateway falhar."""
    if cobranca.status == CobrancaStatus.PAGA:
        return cobranca
    point = db.get(Point, cobranca.point_id)
    if not pagamento_online_ativo(point):
        raise GatewayErro("Este Point ainda não recebe pagamento online. Fale com a recepção.")

    agora = datetime.now()
    valor = float(cobranca.valor)
    if cobranca.pagar_ate is not None:
        # Reserva de aula avulsa: um Pix só, com o prazo da reserva (criado
        # junto com a compra, ver app/services/reserva_avulsa.py).
        if cobranca.pix_pagamento_id and cobranca.pix_expira_em and cobranca.pix_expira_em > agora:
            return cobranca
        if agora >= cobranca.pagar_ate:
            raise GatewayErro("O prazo pra pagar esta reserva acabou. Faça a compra de novo.")
    ainda_vale = (
        cobranca.pix_pagamento_id
        and cobranca.pix_gateway == point.pagamento_gateway
        and cobranca.pix_expira_em is not None
        and cobranca.pix_expira_em - agora > FOLGA_MINIMA
        and cobranca.pix_valor is not None
        and abs(float(cobranca.pix_valor) - valor) < 0.005
    )
    if ainda_vale:
        return cobranca

    gw = gateway(point.pagamento_gateway)
    pix = gw.criar_pix(
        point.pagamento_credencial,
        valor=valor,
        descricao=f"{cobranca.descricao} — {point.nome}",
        referencia=f"cobranca:{cobranca.id}",
        pagador_nome=cobranca.aluno.nome,
        pagador_email=cobranca.aluno.email,
        expira_em=cobranca.pagar_ate if cobranca.pagar_ate is not None else agora + VALIDADE_PIX,
        notificacao_url=_notificacao_url(point),
        point_id=point.id,
    )
    cobranca.pix_gateway = gw.nome
    cobranca.pix_pagamento_id = pix.pagamento_id
    cobranca.pix_copia_cola = pix.copia_cola
    cobranca.pix_qr_base64 = pix.qr_base64
    cobranca.pix_valor = valor
    cobranca.pix_expira_em = pix.expira_em
    return cobranca


def aplicar_pagamento(db: Session, cobranca: Cobranca, pagamento: PagamentoConsultado) -> bool:
    """Dá baixa (sem commit) se o gateway confirmou o pagamento desta
    cobrança. Devolve True quando acabou de marcar como paga."""
    if cobranca.status == CobrancaStatus.PAGA or pagamento.status != "pago":
        return False
    if pagamento.referencia not in (None, f"cobranca:{cobranca.id}"):
        return False
    # Valor pago menor que o cobrado não dá baixa (o Pix tem valor fixo,
    # então só acontece se a cobrança foi editada depois de gerar o Pix).
    if pagamento.valor + 0.005 < float(cobranca.valor):
        return False
    servico_cobrancas.marcar_paga(db, cobranca)
    cobranca.pago_via = "pix"
    return True


def conferir_pix(db: Session, cobranca: Cobranca) -> bool:
    """Pergunta ao gateway pelo Pix atual da cobrança (sem commit). Falha
    de comunicação não derruba a tela — só não muda nada."""
    if cobranca.status == CobrancaStatus.PAGA or not cobranca.pix_pagamento_id:
        return False
    point = db.get(Point, cobranca.point_id)
    gw = gateway(cobranca.pix_gateway)
    if gw is None or point is None or not point.pagamento_credencial:
        return False
    try:
        pagamento = gw.consultar(point.pagamento_credencial, cobranca.pix_pagamento_id, point_id=point.id)
    except GatewayErro:
        return False
    return aplicar_pagamento(db, cobranca, pagamento)
