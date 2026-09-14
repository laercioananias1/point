"""Integração com a WhatsApp Cloud API da Meta direta (pedido do usuário,
2026-09-11: "quero fazer integração com whatsapp para enviar notificações
de agendamento de aula, convites, etc") — começando pelos 3 convites
(aluno, professor, admin); mais eventos entram depois.

Diferente de e-mail: mensagem que a EMPRESA manda primeiro (não é resposta
a uma mensagem do cliente dentro de 24h) exige um "message template"
pré-aprovado pela Meta (WhatsApp Manager → Modelos de mensagem) — texto
fixo com variáveis posicionais ({{1}}, {{2}}...). Não dá pra mandar texto
livre aqui como no e-mail.

Um template POR TIPO de convite (pedido do usuário, 2026-09-11: "a
variavel 3 ser um botao do modelo") — cada template tem corpo
"Olá {{1}}! Você foi convidado(a) pelo {{2}} na plataforma OPoint." +
um botão de URL dinâmica, cuja parte FIXA (ex.: "https://app.opoint.com.br
/convite/") já está aprovada dentro do próprio template na Meta; o que a
API manda na hora é só o sufixo (o token do convite), não o link inteiro.
É por isso que precisa de um template por tipo — aluno aceita em
/convite/{token}, professor em /convite-vinculo/{token}, admin em
/convite-admin/{token}: caminhos diferentes, então botão (e template)
diferente pra cada.

Referência: developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
"""

import re
from typing import Literal

import httpx

from app.core.config import get_settings

TipoConvite = Literal["aluno", "professor", "admin"]


def _normalizar_telefone(celular: str) -> str:
    """Converte pro formato que a Cloud API espera no campo "to": só
    dígitos, com código do país, sem "+" (ex.: "5511987654321"). Assume
    Brasil (55) quando o número não vem com código de país nenhum — é o
    caso de praticamente todo `celular` cadastrado no sistema hoje."""
    digitos = re.sub(r"\D", "", celular)
    if not digitos.startswith("55"):
        digitos = f"55{digitos}"
    return digitos


def _enviar_whatsapp(
    *, celular: str, template: str, variaveis_corpo: list[str], variavel_botao: str | None = None
) -> None:
    """Envio de mensagem via template, compartilhado por todos os tipos de
    notificação. Nunca levanta exceção pra cima — se falhar (ou a
    credencial não estiver configurada), só loga; o e-mail já foi mandado
    de qualquer forma, WhatsApp aqui é um canal extra, não o único.

    `variavel_botao`: só o SUFIXO da URL do botão (ex.: o token do
    convite) — a parte fixa do link já está aprovada dentro do template,
    não manda de novo aqui."""
    settings = get_settings()

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        print(f"[whatsapp] Credencial não configurada — template '{template}' pra {celular}")
        return

    telefone = _normalizar_telefone(celular)
    components: list[dict] = [
        {
            "type": "body",
            "parameters": [{"type": "text", "text": v} for v in variaveis_corpo],
        }
    ]
    if variavel_botao is not None:
        components.append(
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [{"type": "text", "text": variavel_botao}],
            }
        )

    try:
        resposta = httpx.post(
            f"{settings.whatsapp_api_base_url}/{settings.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": telefone,
                "type": "template",
                "template": {"name": template, "language": {"code": "pt_BR"}, "components": components},
            },
            timeout=10,
        )
        resposta.raise_for_status()
    except httpx.HTTPError as erro:
        # Corpo do erro ajuda muito a diagnosticar (ex.: template não
        # aprovado ainda, número fora do formato) — inclui quando existe.
        detalhe = ""
        if isinstance(erro, httpx.HTTPStatusError):
            detalhe = f" — {erro.response.text}"
        print(f"[whatsapp] Falha ao enviar pra {celular}: {erro}{detalhe}")


def enviar_convite_whatsapp(
    *, celular: str | None, nome: str, point_nome: str, token: str, tipo: TipoConvite
) -> None:
    """Convite de aluno/professor/admin (pedido do usuário, 2026-09-11) —
    um template por tipo (ver docstring do módulo), o botão de cada um já
    sabe montar o link certo só com o token. `celular` é obrigatório nos
    três convites hoje (ConviteCriar.celular passou a exigir também, ver
    migration ac46fa2d460a); o parâmetro fica opcional aqui só de defesa
    — sem número, não tem pra onde mandar, então só sai o e-mail mesmo
    (já enviado por quem chamou essa função)."""
    if not celular:
        return
    settings = get_settings()
    template = {
        "aluno": settings.whatsapp_template_convite_aluno,
        "professor": settings.whatsapp_template_convite_professor,
        "admin": settings.whatsapp_template_convite_admin,
    }[tipo]
    _enviar_whatsapp(
        celular=celular,
        template=template,
        variaveis_corpo=[nome, point_nome],
        variavel_botao=token,
    )


def enviar_cancelamento_aula_whatsapp(
    *, celular: str, nome: str, turma_nome: str, data: str, motivo: str
) -> None:
    """Avisa o aluno por WhatsApp quando o professor/admin cancela a aula
    dele por força maior (pedido do usuário, 2026-09-11: "notificacao para
    cencalemento de aula pelo professor") — chamado só pro escopo
    'unica_data' de POST /turmas/{id}/remocoes, pra cada matrícula que
    tinha aula justamente na data removida (mesma lista que gera o crédito
    de reposição, ver routers/turmas.py). Sem botão — é só aviso, não
    precisa de nenhuma ação de volta do aluno (ver decisão do usuário,
    2026-09-11: confirmação de presença com botão fica pra depois)."""
    template = get_settings().whatsapp_template_cancelamento_aula
    _enviar_whatsapp(
        celular=celular,
        template=template,
        variaveis_corpo=[nome, turma_nome, data, motivo],
    )


def enviar_confirmacao_experimental_whatsapp(
    *, celular: str, nome: str, modalidade_nome: str, point_nome: str, data_horario: str
) -> None:
    """Avisa por WhatsApp quem pediu aula experimental pela página pública
    que o professor/admin aprovou (pedido do usuário, 2026-09-14: "faca um
    template para confirmacao de aula experimental no whatsapp") — chamado
    em routers/experimental.py::aprovar_solicitacao. Sem botão, só
    confirmação; `data_horario` já vem formatado pronto (ex.: "15/09 às
    06h") pra não precisar de duas variáveis separadas no template."""
    template = get_settings().whatsapp_template_confirmacao_experimental
    _enviar_whatsapp(
        celular=celular,
        template=template,
        variaveis_corpo=[nome, modalidade_nome, point_nome, data_horario],
    )
