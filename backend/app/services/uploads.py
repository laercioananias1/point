"""Upload de imagem de Point (pedido do usuário, 2026-08-30: "Meu Point...
permitir inserir até 5 fotos"; depois "anúncios será imagens também, como
banners" — mesma infra, categoria diferente). Sem infra externa disponível
neste MVP (nenhum S3/storage já configurado no projeto) — salva em disco,
dentro do bind mount do container (backend/uploads, ver docker-compose.yml),
servido como arquivo estático em /uploads (ver app/main.py). Mesmo espírito
do scheduler em processo (app/services/scheduler.py): simples o bastante
pro MVP, best-effort — troca por S3/CDN de verdade quando escalar."""

import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

EXTENSOES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp"}
TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5 MB


def salvar_imagem_point(point_id: int, categoria: str, arquivo: UploadFile, conteudo: bytes) -> str:
    """Salva uma imagem de Point em disco e devolve a URL pública (relativa
    — o front já sabe montar com a base da API). `categoria` separa o tipo
    de imagem em pastas ("fotos", "banners", ...) — mesmo Point, usos
    diferentes. Nome do arquivo é um uuid pra não colidir nem expor o nome
    original enviado."""
    extensao = Path(arquivo.filename or "").suffix.lower()
    if extensao not in EXTENSOES_PERMITIDAS:
        raise ValueError("Formato de imagem não suportado — use jpg, png ou webp")

    pasta = UPLOADS_DIR / "points" / str(point_id) / categoria
    pasta.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"{uuid.uuid4().hex}{extensao}"
    (pasta / nome_arquivo).write_bytes(conteudo)
    return f"/uploads/points/{point_id}/{categoria}/{nome_arquivo}"


def remover_imagem_point(url: str) -> None:
    """Apaga o arquivo físico correspondente a uma URL salva por
    salvar_imagem_point — silencioso se o arquivo já não existir mais
    (idempotente, pra não travar a remoção do registro por causa disso)."""
    caminho = UPLOADS_DIR / url.removeprefix("/uploads/")
    caminho.unlink(missing_ok=True)
