from app.schemas.common import ORMModel


class PlanoCreate(ORMModel):
    frequencia_semanal: int  # 1..6
    preco: float


# Só o preço é editável (pedido do usuário, 2026-09-01) — a frequência
# semanal é a identidade do plano (cada Point tem no máximo 1 por
# frequência, ver frequenciasDisponiveis em CadastrarPlano.tsx); deixar
# editar abriria brecha pra duplicar frequência sem essa checagem aqui.
class PlanoUpdate(ORMModel):
    preco: float | None = None


class PlanoOut(ORMModel):
    id: int
    point_id: int
    frequencia_semanal: int
    preco: float
