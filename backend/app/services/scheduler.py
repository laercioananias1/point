"""Job diário de geração de aulas do mês (pedido do usuário, 2026-08-21:
"pode automatizar"). Sem infra externa disponível neste MVP (o comentário
original em assinaturas.py já previa isso virar um job agendado de verdade
em produção — seção 7, EventBridge Scheduler) — então roda EM PROCESSO,
dentro da própria API, via APScheduler.

Roda todo dia (não só uma vez por mês) de propósito: `gerar_aulas_do_mes` já
é idempotente (não duplica aula existente), então rodar todo dia é só mais
seguro que uma vez só no mês — pega matrícula nova criada no meio do mês,
e destrava sozinho quem regularizou um atraso, sem esperar o próximo ciclo.

Ressalva conhecida: com múltiplos workers/processos da API rodando ao mesmo
tempo (não é o caso deste deploy — um único processo Uvicorn), cada um
teria seu próprio agendador e o job rodaria em duplicidade; inofensivo aqui
porque a geração é idempotente, mas vale lembrar antes de escalar para
vários workers."""

import traceback

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.services.aulas import gerar_aulas_do_mes_em_lote

# print(), não logging — mesmo padrão já usado em app/services/email.py (o
# projeto não configura handler de logging em lugar nenhum).
_scheduler: BackgroundScheduler | None = None


def _rodar_geracao_de_aulas() -> None:
    db = SessionLocal()
    try:
        total = gerar_aulas_do_mes_em_lote(db)
        print(f"[scheduler] geração diária de aulas: {total} aula(s) criada(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha ao gerar aulas do mês:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def iniciar_scheduler() -> BackgroundScheduler:
    """Chamada uma vez, no startup da API (ver app/main.py)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    # 04:00 — de madrugada, fora do horário de uso do app.
    scheduler.add_job(
        _rodar_geracao_de_aulas,
        trigger="cron",
        hour=4,
        minute=0,
        id="gerar_aulas_do_mes_diario",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    print("[scheduler] iniciado — geração de aulas todo dia às 04:00")
    return scheduler


def parar_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
