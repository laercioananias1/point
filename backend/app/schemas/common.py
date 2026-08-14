from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base para schemas de resposta lidos direto de um model SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)
