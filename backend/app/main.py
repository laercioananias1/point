from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.database import SessionLocal
from app.routers import (
    alunos,
    auth,
    configuracoes,
    creditos,
    fechamentos,
    matriculas,
    modalidades,
    pagamentos,
    points,
    professores,
    quadras,
    turmas,
    vinculos,
)

app = FastAPI(title="Point API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
