import re

from pydantic import field_validator

from app.schemas.common import ORMModel

_COR_INVALIDA = "Cor precisa ser um hexadecimal no formato #rrggbb"


def _valida_cor(valor: str) -> str:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", valor):
        raise ValueError(_COR_INVALIDA)
    return valor


class CategoriaCreate(ORMModel):
    nome: str
    cor: str

    @field_validator("cor")
    @classmethod
    def _cor_valida(cls, valor: str) -> str:
        return _valida_cor(valor)


class CategoriaUpdate(ORMModel):
    nome: str | None = None
    cor: str | None = None

    @field_validator("cor")
    @classmethod
    def _cor_valida(cls, valor: str | None) -> str | None:
        return _valida_cor(valor) if valor is not None else None


class CategoriaOut(ORMModel):
    id: int
    point_id: int
    nome: str
    cor: str
