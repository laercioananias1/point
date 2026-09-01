from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.scheduler import iniciar_scheduler, parar_scheduler
from app.services.uploads import UPLOADS_DIR
from app.routers import (
    alunos,
    assinaturas,
    auth,
    checkins,
    configuracoes,
    convites,
    convites_admin,
    convites_vinculo,
    creditos,
    fechamentos,
    matriculas,
    modalidades,
    pagamentos,
    planos,
    points,
    professores,
    quadras,
    turmas,
    vinculos,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Job diário de geração de aulas do mês (pedido do usuário, 2026-08-21) —
    # ver app/services/scheduler.py.
    iniciar_scheduler()
    yield
    parar_scheduler()


app = FastAPI(title="Point API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Configurável via CORS_ORIGINS no .env (pedido do usuário, 2026-08-30:
    # deploy em produção) — dev usa o padrão (só o Vite local); produção
    # aponta pro domínio de verdade (ex.: https://opoint.com.br).
    allow_origins=get_settings().cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(points.router)
app.include_router(professores.router)
app.include_router(alunos.router)
app.include_router(vinculos.router)
app.include_router(modalidades.router)
app.include_router(quadras.router)
app.include_router(turmas.router)
app.include_router(matriculas.router)
app.include_router(pagamentos.router)
app.include_router(configuracoes.router)
app.include_router(creditos.router)
app.include_router(fechamentos.router)
app.include_router(planos.router)
app.include_router(assinaturas.router)
app.include_router(convites.router)
app.include_router(convites_vinculo.router)
app.include_router(convites_admin.router)
app.include_router(checkins.router)

# Fotos de Point (pedido do usuário, 2026-08-30) — arquivo estático servido
# direto, sem passar por rota autenticada (mesma URL vale pra qualquer
# aluno/professor ver a foto na Início). UPLOADS_DIR precisa existir antes
# do mount, senão o StaticFiles recusa subir.
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    """Confirma que a API está no ar e consegue falar com o banco."""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 — endpoint de diagnóstico
        db_status = f"erro: {exc}"

    return {"api": "ok", "database": db_status}
