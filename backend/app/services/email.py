from html import escape

import httpx

from app.core.config import get_settings
from app.models.enums import PagamentoMeio
from app.services.integracao_logs import registrar_em_sessao_propria

# Wellhub/TotalPass não cobram do aluno pelo Point — o valor do plano não
# se aplica (pedido do usuário, 2026-09-01: "quando o plano é wellhub ou
# totalpass nao pode mostrar o valor do plano... Informe o beneficio").
_ROTULO_BENEFICIO = {PagamentoMeio.WELLHUB: "Wellhub", PagamentoMeio.TOTALPASS: "TotalPass"}


def _enviar(
    *, email: str, assunto: str, html: str, link_fallback: str = "", point_id: int | None = None
) -> None:
    """Envio de e-mail via Resend, compartilhado pelos convites de assinatura
    e de vínculo e pelo lembrete de mensalidade (pedido do usuário,
    2026-08-21). Nunca levanta exceção pra cima — se falhar (ou a chave não
    estiver configurada), só loga; pra convite, o link continua válido e
    quem convidou pode copiar e mandar por fora se precisar."""
    settings = get_settings()

    if not settings.resend_api_key:
        detalhe = f" — link: {link_fallback}" if link_fallback else ""
        print(f"[email] RESEND_API_KEY não configurada — '{assunto}' pra {email}{detalhe}")
        registrar_em_sessao_propria(
            integracao="email",
            evento=assunto,
            sucesso=False,
            mensagem="RESEND_API_KEY não configurada",
            destino=email,
            point_id=point_id,
        )
        return

    # Pra log (pedido do usuário, 2026-09-29: "quero ver tb o request e
    # response") — nunca o header Authorization, só o corpo mandado.
    request_corpo = (
        f"POST https://api.resend.com/emails\n"
        f'{{"from": "{settings.resend_from}", "to": ["{email}"], "subject": "{assunto}", "html": "(ver e-mail — omitido do log)"}}'
    )
    response_corpo: str | None = None

    try:
        resposta = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.resend_from, "to": [email], "subject": assunto, "html": html},
            timeout=10,
        )
        response_corpo = f"{resposta.status_code}\n{resposta.text}"
        resposta.raise_for_status()
    except httpx.HTTPError as erro:
        print(f"[email] Falha ao enviar convite pra {email}: {erro}")
        registrar_em_sessao_propria(
            integracao="email",
            evento=assunto,
            sucesso=False,
            mensagem=str(erro),
            destino=email,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
    else:
        registrar_em_sessao_propria(
            integracao="email",
            evento=assunto,
            sucesso=True,
            mensagem="Enviado",
            destino=email,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )


# ---- Layout dos e-mails (pedido do usuário, 2026-10-02: e-mails no visual
# do kit) ----------------------------------------------------------------
# Só tabela + estilo inline: é o que Gmail, Outlook e apps de celular
# respeitam (nada de <style>, flex ou SVG). Cores fixas da marca; fonte do
# kit com reserva, já que a maioria dos clientes não carrega web font.
_NAVY = "#0B2A3C"
_AREIA = "#F6F1E7"
_LIMAO = "#D4F04A"
_TEXTO = "#2C4A5A"
_SUAVE = "#4F6B7A"
_FONTE = "'DM Sans', Helvetica, Arial, sans-serif"
_FONTE_TITULO = "'Bricolage Grotesque', 'Arial Black', Helvetica, Arial, sans-serif"


def _p(texto_html: str) -> str:
    return f'<p style="margin:0 0 14px;font-family:{_FONTE};font-size:16px;line-height:1.55;color:{_TEXTO};">{texto_html}</p>'


def _destaques(itens: list[tuple[str, str]]) -> str:
    """Blocos rótulo/valor (valor, vencimento, quantos check-ins faltam)."""
    celulas = "".join(
        f"""<td style="padding:4px;" valign="top">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_AREIA};border-radius:14px;">
            <tr><td style="padding:12px 14px;">
              <div style="font-family:{_FONTE};font-size:12px;color:{_SUAVE};">{escape(rotulo)}</div>
              <div style="font-family:{_FONTE_TITULO};font-size:20px;font-weight:800;color:{_NAVY};">{escape(valor)}</div>
            </td></tr>
          </table>
        </td>"""
        for rotulo, valor in itens
    )
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px -4px 16px;"><tr>{celulas}</tr></table>'


def _layout(
    *,
    titulo: str,
    corpo: str,
    point_nome: str | None = None,
    acao: tuple[str, str] | None = None,
    nota: str | None = None,
) -> str:
    """Moldura comum: faixa marinho com a marca (o Point, quando tem), cartão
    branco sobre areia, botão limão e rodapé. `corpo` já vem em HTML (os
    valores do usuário escapados por quem monta); `titulo`/`nota` são texto."""
    if point_nome:
        marca = (
            f'<div style="font-family:{_FONTE_TITULO};font-size:22px;font-weight:800;color:{_AREIA};">{escape(point_nome)}</div>'
            f'<div style="font-family:{_FONTE};font-size:12px;color:#C9D6DD;margin-top:2px;">via OPoint</div>'
        )
    else:
        marca = (
            f'<span style="font-family:{_FONTE_TITULO};font-size:24px;font-weight:800;color:{_AREIA};letter-spacing:-0.5px;">'
            f'O<span style="color:{_LIMAO};">&#9679;</span>Point</span>'
        )
    botao = ""
    if acao:
        rotulo, link = acao
        botao = f"""
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
            <tr><td style="background:{_LIMAO};border-radius:999px;">
              <a href="{escape(link, quote=True)}" style="display:inline-block;padding:14px 28px;font-family:{_FONTE};font-size:16px;font-weight:700;color:{_NAVY};text-decoration:none;border-radius:999px;">{escape(rotulo)}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;font-family:{_FONTE};font-size:12px;line-height:1.5;color:{_SUAVE};">
            Se o botão não funcionar, copie este link:<br>
            <span style="word-break:break-all;color:{_NAVY};">{escape(link)}</span>
          </p>"""
    rodape_nota = (
        f'<p style="margin:12px 0 0;font-family:{_FONTE};font-size:12px;line-height:1.5;color:{_SUAVE};">{escape(nota)}</p>'
        if nota
        else ""
    )
    return f"""<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:{_AREIA};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_AREIA};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="background:{_NAVY};border-radius:20px 20px 0 0;padding:22px 28px;">{marca}</td></tr>
      <tr><td style="background:#FFFFFF;border-radius:0 0 20px 20px;padding:28px;">
        <h1 style="margin:0 0 16px;font-family:{_FONTE_TITULO};font-size:26px;line-height:1.15;font-weight:800;color:{_NAVY};">{escape(titulo)}</h1>
        {corpo}
        {botao}
        {rodape_nota}
      </td></tr>
      <tr><td align="center" style="padding:18px 8px 0;font-family:{_FONTE};font-size:12px;color:{_SUAVE};">
        OPoint &middot; Sua arena no ponto.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _reais(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def enviar_convite_email(
    *,
    nome: str,
    email: str,
    link: str,
    point_nome: str,
    modalidade_nome: str,
    frequencia: int,
    preco: float,
    fonte_pagamento: PagamentoMeio,
    point_id: int | None = None,
) -> None:
    """E-mail de convite de assinatura (aluno) — pedido do usuário, 2026-08-20.
    Wellhub/TotalPass mostra o benefício em vez do valor (pedido do usuário,
    2026-09-01) — quem paga é o benefício, não o aluno via Pix pro Point."""
    beneficio = _ROTULO_BENEFICIO.get(fonte_pagamento)
    html = _layout(
        point_nome=point_nome,
        titulo="Você foi convidado(a) pra um plano",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(f"O {escape(point_nome)} te convidou pra assinar o plano de <strong>{escape(modalidade_nome)}</strong>.")
        + _destaques(
            [
                ("Frequência", f"{frequencia}x por semana"),
                ("Pagamento", f"via {beneficio}" if beneficio else f"{_reais(preco)}/mês"),
            ]
        ),
        acao=("Aceitar convite", link),
    )
    _enviar(
        email=email,
        assunto=f"Convite — plano mensal no {point_nome}",
        html=html,
        link_fallback=link,
        point_id=point_id,
    )


def enviar_convite_avulso_email(
    *, nome: str, email: str, link: str, point_nome: str, point_id: int | None = None
) -> None:
    """Convite avulso (pedido do usuário, 2026-09-11) — sem plano/preço pra
    mostrar, é só um link pra entrar na plataforma; o aluno escolhe e
    compra as próprias aulas depois de aceitar."""
    html = _layout(
        point_nome=point_nome,
        titulo=f"Você foi convidado(a) pelo {point_nome}",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(
            f"O {escape(point_nome)} te convidou pra entrar na plataforma. Depois de aceitar, "
            "você mesmo escolhe e agenda suas aulas quando quiser."
        ),
        acao=("Aceitar convite", link),
    )
    _enviar(
        email=email, assunto=f"Convite — {point_nome}", html=html, link_fallback=link, point_id=point_id
    )


def enviar_convite_vinculo_email(
    *, nome: str, email: str, link: str, point_nome: str, point_id: int | None = None
) -> None:
    """E-mail de convite de vínculo (professor) — mesmo padrão do convite de
    assinatura do aluno (pedido do usuário, 2026-08-21: "quem manda a
    solicitação é o admin do Point... ficar no mesmo padrão do aluno").
    Preço de aula avulsa/plano é tabela do Point, não entra aqui."""
    html = _layout(
        point_nome=point_nome,
        titulo="Você foi convidado(a) pra dar aula",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(f"O {escape(point_nome)} te convidou pra fazer parte do time de professores."),
        acao=("Aceitar convite", link),
    )
    _enviar(
        email=email,
        assunto=f"Convite — dar aula no {point_nome}",
        html=html,
        link_fallback=link,
        point_id=point_id,
    )


def enviar_convite_admin_email(
    *, nome: str, email: str, link: str, point_nome: str, point_id: int | None = None
) -> None:
    """E-mail de convite de admin do Point — mesmo padrão dos outros dois
    convites (pedido do usuário, 2026-08-26: "não quero criar senha de
    admin, faça o mesmo padrão de aluno e professor"). Sem acordo nenhum
    pra decidir (não é plano nem preço) — só o Point de destino."""
    html = _layout(
        point_nome=point_nome,
        titulo="Você foi convidado(a) pra administrar o Point",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(f"Você foi convidado(a) pra ser admin do <strong>{escape(point_nome)}</strong> no OPoint."),
        acao=("Aceitar convite", link),
    )
    _enviar(
        email=email,
        assunto=f"Convite — administrar o {point_nome}",
        html=html,
        link_fallback=link,
        point_id=point_id,
    )


def enviar_redefinicao_senha_email(*, nome: str, email: str, link: str) -> None:
    """E-mail de redefinição de senha (pedido do usuário, 2026-09-01: "a
    troca de senha precisa ser por email" — substitui a tela de trocar
    senha que exigia saber a senha atual). Link de vida curta (1h, ver
    app/models/redefinicao_senha.py) — quem não pediu pode ignorar. Sem
    point_id: acontece antes de qualquer login, não tem Point envolvido."""
    html = _layout(
        titulo="Redefinir sua senha",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p("Recebemos um pedido pra redefinir a senha da sua conta. O link abaixo vale por <strong>1 hora</strong>."),
        acao=("Redefinir senha", link),
        nota="Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.",
    )
    _enviar(email=email, assunto="Redefinição de senha", html=html, link_fallback=link)


def enviar_lembrete_mensalidade_email(
    *,
    nome: str,
    email: str,
    point_nome: str,
    modalidade_nome: str,
    valor: float,
    mes_referencia: str,
    point_id: int | None = None,
) -> None:
    """Lembrete manual de mensalidade em aberto (pedido do usuário,
    2026-08-21) — sem job agendado ainda (seção 7), o admin do Point decide
    a hora de mandar. Sem link de ação: o pagamento é feito pelo próprio
    aluno, logado, na tela dele — aqui é só o aviso."""
    html = _layout(
        point_nome=point_nome,
        titulo=f"Mensalidade de {mes_referencia} em aberto",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(
            f"A mensalidade de <strong>{escape(modalidade_nome)}</strong> no {escape(point_nome)} "
            "ainda não foi paga. Entre no seu painel pra pagar via Pix."
        )
        + _destaques([("Referente a", mes_referencia), ("Valor", _reais(valor))]),
    )
    _enviar(
        email=email,
        assunto=f"Lembrete — mensalidade de {mes_referencia} em aberto",
        html=html,
        point_id=point_id,
    )


def enviar_cobranca_email(
    *,
    nome: str,
    email: str,
    point_nome: str,
    descricao: str,
    valor: float,
    vencimento: str,
    point_id: int | None = None,
    link_pagamento: str | None = None,
) -> None:
    """Lembrete de cobrança em aberto (pedido do usuário, 2026-09-20: tela
    de Cobranças) — cobrança pode ser avulsa (uniforme, evento...), então
    ao contrário de enviar_lembrete_mensalidade_email não amarra a uma
    modalidade nem manda o aluno pagar por Pix no painel."""
    html = _layout(
        point_nome=point_nome,
        titulo="Você tem uma cobrança em aberto",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(f"Ficou em aberto no {escape(point_nome)}: <strong>{escape(descricao)}</strong>.")
        + _destaques([("Valor", _reais(valor)), ("Vencimento", vencimento)]),
        # Point com pagamento online (pedido do usuário, 2026-10-02): botão
        # que abre o Pix da cobrança.
        acao=("Pagar com Pix", link_pagamento) if link_pagamento else None,
        nota="Qualquer dúvida, fale com o seu Point.",
    )
    _enviar(
        email=email,
        assunto=f"Cobrança em aberto — {descricao}",
        html=html,
        point_id=point_id,
    )


def enviar_lembrete_checkin_email(
    *,
    nome: str,
    email: str,
    point_nome: str,
    faltam: int,
    plataforma: str,
    point_id: int | None = None,
) -> None:
    """Lembrete de check-in pendente no mês (pedido do usuário, 2026-10-02),
    mesmo par WhatsApp + e-mail da cobrança."""
    plural = "check-ins" if faltam > 1 else "check-in"
    html = _layout(
        point_nome=point_nome,
        titulo=f"Faltam check-ins no {plataforma}",
        corpo=_p(f"Olá, {escape(nome)}!")
        + _p(
            f"Neste mês você fez mais aulas no {escape(point_nome)} do que check-ins no {escape(plataforma)}."
        )
        + _destaques([("Faltam", f"{faltam} {plural}"), ("Até", "o fim do mês")]),
        nota=f"O check-in pode ser feito em qualquer dia, pelo app do {plataforma}.",
    )
    _enviar(
        email=email,
        assunto=f"Faltam {faltam} {plural} no {plataforma}",
        html=html,
        point_id=point_id,
    )
