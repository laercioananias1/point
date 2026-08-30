import httpx

from app.core.config import get_settings


def _enviar(*, email: str, assunto: str, html: str, link_fallback: str = "") -> None:
    """Envio de e-mail via Resend, compartilhado pelos convites de assinatura
    e de vínculo e pelo lembrete de mensalidade (pedido do usuário,
    2026-08-21). Nunca levanta exceção pra cima — se falhar (ou a chave não
    estiver configurada), só loga; pra convite, o link continua válido e
    quem convidou pode copiar e mandar por fora se precisar."""
    settings = get_settings()

    if not settings.resend_api_key:
        detalhe = f" — link: {link_fallback}" if link_fallback else ""
        print(f"[email] RESEND_API_KEY não configurada — '{assunto}' pra {email}{detalhe}")
        return

    try:
        resposta = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.resend_from, "to": [email], "subject": assunto, "html": html},
            timeout=10,
        )
        resposta.raise_for_status()
    except httpx.HTTPError as erro:
        print(f"[email] Falha ao enviar convite pra {email}: {erro}")


def enviar_convite_email(
    *, nome: str, email: str, link: str, point_nome: str, modalidade_nome: str, frequencia: int, preco: float
) -> None:
    """E-mail de convite de assinatura (aluno) — pedido do usuário, 2026-08-20."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Você foi convidado(a) pra um plano no {point_nome}</h2>
      <p>Olá, {nome}!</p>
      <p>
        O {point_nome} te convidou pra assinar o plano de <strong>{modalidade_nome}</strong>,
        {frequencia}x por semana (R$ {preco:.2f}/mês).
      </p>
      <p>
        <a href="{link}" style="display:inline-block;padding:10px 20px;background:#0e9594;
           color:#fff;text-decoration:none;border-radius:6px;">Aceitar convite</a>
      </p>
      <p style="color:#666;font-size:13px;">Se o botão não funcionar, copie este link: {link}</p>
    </div>
    """
    _enviar(
        email=email, assunto=f"Convite — plano mensal no {point_nome}", html=html, link_fallback=link
    )


def enviar_convite_vinculo_email(
    *, nome: str, email: str, link: str, point_nome: str, modelo_repasse: str, valor_repasse: float
) -> None:
    """E-mail de convite de vínculo (professor) — mesmo padrão do convite de
    assinatura do aluno (pedido do usuário, 2026-08-21: "quem manda a
    solicitação é o admin do Point... ficar no mesmo padrão do aluno").
    Preço de aula avulsa/plano é tabela do Point, não entra aqui — o
    professor só decide o acordo de repasse."""
    repasse_legivel = modelo_repasse.replace("_", " ")
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Você foi convidado(a) pra dar aula no {point_nome}</h2>
      <p>Olá, {nome}!</p>
      <p>
        O {point_nome} te convidou pra fazer parte do time de professores — repasse:
        {repasse_legivel} ({valor_repasse:.2f}).
      </p>
      <p>
        <a href="{link}" style="display:inline-block;padding:10px 20px;background:#0e9594;
           color:#fff;text-decoration:none;border-radius:6px;">Aceitar convite</a>
      </p>
      <p style="color:#666;font-size:13px;">Se o botão não funcionar, copie este link: {link}</p>
    </div>
    """
    _enviar(
        email=email, assunto=f"Convite — dar aula no {point_nome}", html=html, link_fallback=link
    )


def enviar_convite_admin_email(*, nome: str, email: str, link: str, point_nome: str) -> None:
    """E-mail de convite de admin do Point — mesmo padrão dos outros dois
    convites (pedido do usuário, 2026-08-26: "não quero criar senha de
    admin, faça o mesmo padrão de aluno e professor"). Sem acordo nenhum
    pra decidir (não é repasse nem plano) — só o Point de destino."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Você foi convidado(a) pra administrar o {point_nome}</h2>
      <p>Olá, {nome}!</p>
      <p>Você foi convidado(a) pra ser admin do Point <strong>{point_nome}</strong> na plataforma.</p>
      <p>
        <a href="{link}" style="display:inline-block;padding:10px 20px;background:#0e9594;
           color:#fff;text-decoration:none;border-radius:6px;">Aceitar convite</a>
      </p>
      <p style="color:#666;font-size:13px;">Se o botão não funcionar, copie este link: {link}</p>
    </div>
    """
    _enviar(
        email=email, assunto=f"Convite — administrar o {point_nome}", html=html, link_fallback=link
    )


def enviar_lembrete_mensalidade_email(
    *, nome: str, email: str, point_nome: str, modalidade_nome: str, valor: float, mes_referencia: str
) -> None:
    """Lembrete manual de mensalidade em aberto (pedido do usuário,
    2026-08-21) — sem job agendado ainda (seção 7), o admin do Point decide
    a hora de mandar. Sem link de ação: o pagamento é feito pelo próprio
    aluno, logado, na tela dele — aqui é só o aviso."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Mensalidade de {mes_referencia} em aberto — {point_nome}</h2>
      <p>Olá, {nome}!</p>
      <p>
        A mensalidade de <strong>{modalidade_nome}</strong> no {point_nome} referente a
        <strong>{mes_referencia}</strong> (R$ {valor:.2f}) ainda não foi paga. Entre no seu painel
        pra pagar via Pix.
      </p>
    </div>
    """
    _enviar(email=email, assunto=f"Lembrete — mensalidade de {mes_referencia} em aberto", html=html)
