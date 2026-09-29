"""Log de chamadas a integrações externas (pedido do usuário, 2026-09-29:
"tela de logs de integrações, assim fico sabendo se tá dando erro ou
não" / "quero ver tb o request e response") — ver
app/models/integracao_log.py pro porquê do desenho.

`registrar` nunca levanta exceção — logar a falha de uma integração não
pode, ela mesma, virar uma nova falha que derruba o fluxo que a chamou
(mesmo espírito fail-soft do resto dessas integrações)."""

import traceback

from sqlalchemy.orm import Session

from app.models.integracao_log import IntegracaoLog

# Corpo cru pode ser grande (HTML de e-mail, JSON de erro verboso) — corta
# antes de gravar, só pra não deixar uma linha de log gigante travar a
# tela. Bem acima do que qualquer request/response dessas integrações
# costuma ter de verdade.
_LIMITE_CORPO = 4000


def _cortar(texto: str | None, limite: int) -> str | None:
    if texto is None:
        return None
    return texto if len(texto) <= limite else f"{texto[:limite]}… (cortado)"


def registrar(
    db: Session,
    *,
    integracao: str,
    evento: str,
    sucesso: bool,
    mensagem: str,
    destino: str | None = None,
    point_id: int | None = None,
    request_corpo: str | None = None,
    response_corpo: str | None = None,
) -> None:
    try:
        db.add(
            IntegracaoLog(
                integracao=integracao,
                evento=evento[:120],
                destino=_cortar(destino, 160),
                point_id=point_id,
                sucesso=sucesso,
                mensagem=_cortar(mensagem, 500),
                request_corpo=_cortar(request_corpo, _LIMITE_CORPO),
                response_corpo=_cortar(response_corpo, _LIMITE_CORPO),
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 — log nunca pode derrubar quem chamou
        db.rollback()
        print("[integracao_logs] falha ao registrar log:")
        traceback.print_exc()


def registrar_em_sessao_propria(
    *,
    integracao: str,
    evento: str,
    sucesso: bool,
    mensagem: str,
    destino: str | None = None,
    point_id: int | None = None,
    request_corpo: str | None = None,
    response_corpo: str | None = None,
) -> None:
    """Mesmo `registrar` acima, mas abre a própria sessão (mesmo padrão de
    app/services/scheduler.py) — pra chamar de dentro de services que não
    recebem `db` (whatsapp.py, email.py, totalpass.py, wellhub.py), sem
    precisar espalhar `db: Session` pelos call sites desses módulos só
    pra logar."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        registrar(
            db,
            integracao=integracao,
            evento=evento,
            sucesso=sucesso,
            mensagem=mensagem,
            destino=destino,
            point_id=point_id,
            request_corpo=request_corpo,
            response_corpo=response_corpo,
        )
    finally:
        db.close()
