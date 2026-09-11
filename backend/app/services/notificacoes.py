"""Notificações dentro do próprio app (pedido do usuário, 2026-09-11: "esse
tipo de msg é bom tb ter no app... já tava previsto lá no início fazermos
uma tela de notificações") — complementa o WhatsApp/e-mail, não substitui:
quem não vê a mensagem externa ainda encontra o aviso dentro do produto.

Mesmo espírito dos serviços de e-mail/WhatsApp (services/email.py,
services/whatsapp.py): uma função simples pra quem dispara o evento chamar,
sem se preocupar com a persistência. Diferente deles, não é "fail-soft" —
é gravação local no próprio banco, sem chamada de rede nenhuma, então não
tem por que engolir erro aqui."""

from sqlalchemy.orm import Session

from app.models.enums import NotificacaoTipo
from app.models.notificacao import Notificacao


def criar_notificacao(
    db: Session, *, user_id: int, tipo: NotificacaoTipo, titulo: str, mensagem: str
) -> Notificacao:
    notificacao = Notificacao(user_id=user_id, tipo=tipo, titulo=titulo, mensagem=mensagem)
    db.add(notificacao)
    db.commit()
    db.refresh(notificacao)
    return notificacao
