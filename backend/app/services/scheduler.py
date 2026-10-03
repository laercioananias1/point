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
from app.services.caixa import gerar_lancamentos_fixos
from app.services.cobrancas import gerar_mensalidades, rodar_regua
from app.services.lembrete_checkin import rodar_lembretes as rodar_lembretes_checkin
from app.services.reserva_avulsa import expirar_reservas

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


def _rodar_geracao_de_mensalidades() -> None:
    """Todo dia 1 (pedido do usuário, 2026-09-20: "as cobranças entram
    sozinhas todo dia 1") — só uma vez por mês, e não todo dia como as
    aulas, pra não recriar uma cobrança que o admin apagou de propósito;
    quem precisar fora do dia 1 usa o "gerar agora" da tela."""
    db = SessionLocal()
    try:
        total = gerar_mensalidades(db)
        print(f"[scheduler] geração mensal de cobranças: {total} mensalidade(s) criada(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha ao gerar mensalidades:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _rodar_lancamentos_fixos() -> None:
    """Todo dia (pedido do usuário, 2026-09-20: "repetir todo mês, no dia da
    data") — cada fixo só cria o lançamento do mês uma vez (fixo+mês é
    único), então rodar diariamente também recupera um dia com o servidor
    fora."""
    db = SessionLocal()
    try:
        total = gerar_lancamentos_fixos(db)
        print(f"[scheduler] lançamentos fixos do caixa: {total} criado(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha ao gerar lançamentos fixos:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _rodar_regua_de_cobranca() -> None:
    """Todo dia às 09:00 (pedido do usuário, 2026-10-01: régua de cobrança)
    — horário comercial, não de madrugada como os outros jobs, porque
    manda mensagem pro aluno. Cada etapa sai uma vez só por cobrança
    (registro em cobranca_lembretes)."""
    db = SessionLocal()
    try:
        total = rodar_regua(db)
        print(f"[scheduler] régua de cobrança: {total} lembrete(s) enviado(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha na régua de cobrança:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _rodar_lembretes_de_checkin() -> None:
    """Todo dia às 10:00 (pedido do usuário, 2026-10-02) — o serviço só
    manda de fato na segunda e no dia 25."""
    db = SessionLocal()
    try:
        total = rodar_lembretes_checkin(db)
        print(f"[scheduler] lembrete de check-in: {total} enviado(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha no lembrete de check-in:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _rodar_expiracao_de_reservas() -> None:
    """A cada 2 minutos (pedido do usuário, 2026-10-02: aula avulsa com Pix
    "segura a vaga por um tempo") — solta a vaga de quem não pagou."""
    db = SessionLocal()
    try:
        total = expirar_reservas(db)
        if total:
            print(f"[scheduler] reservas avulsas vencidas: {total} cancelada(s)")
    except Exception:  # noqa: BLE001 — job de fundo não pode derrubar o processo
        print("[scheduler] falha ao expirar reservas:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


# Cadeado entre processos (pedido do usuário, 2026-10-02: produção roda
# `uvicorn --workers 2`, e cada worker subia o próprio agendador — régua de
# cobrança e lembrete de check-in saíam em dobro). Só o worker que pega o
# lock de arquivo roda os jobs; o arquivo fica aberto enquanto o processo
# vive, e o lock se solta sozinho se ele morrer.
_ARQUIVO_LOCK = "/tmp/opoint-scheduler.lock"
_lock = None


def _pegar_lock() -> bool:
    global _lock
    try:
        import fcntl
    except ImportError:  # Windows (testes fora do container): sem disputa
        return True
    arquivo = open(_ARQUIVO_LOCK, "w")  # noqa: SIM115 — fica aberto de propósito
    try:
        fcntl.flock(arquivo, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        arquivo.close()
        return False
    _lock = arquivo
    return True


def iniciar_scheduler() -> BackgroundScheduler | None:
    """Chamada no startup de cada worker da API (ver app/main.py) — só um
    deles fica com o agendador."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    if not _pegar_lock():
        print("[scheduler] outro worker já roda o agendador — este fica sem")
        return None

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
    scheduler.add_job(
        _rodar_geracao_de_mensalidades,
        trigger="cron",
        day=1,
        hour=4,
        minute=10,
        id="gerar_mensalidades_mensal",
        replace_existing=True,
    )
    scheduler.add_job(
        _rodar_lancamentos_fixos,
        trigger="cron",
        hour=4,
        minute=20,
        id="gerar_lancamentos_fixos_diario",
        replace_existing=True,
    )
    scheduler.add_job(
        _rodar_regua_de_cobranca,
        trigger="cron",
        hour=9,
        minute=0,
        id="regua_cobranca_diaria",
        replace_existing=True,
    )
    scheduler.add_job(
        _rodar_lembretes_de_checkin,
        trigger="cron",
        hour=10,
        minute=0,
        id="lembrete_checkin_diario",
        replace_existing=True,
    )
    scheduler.add_job(
        _rodar_expiracao_de_reservas,
        trigger="interval",
        minutes=2,
        id="expirar_reservas_avulsas",
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
