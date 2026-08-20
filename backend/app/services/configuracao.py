from sqlalchemy.orm import Session

from app.models.configuracao import ConfiguracaoPlataforma


def get_ou_criar_configuracao(db: Session) -> ConfiguracaoPlataforma:
    config = db.get(ConfiguracaoPlataforma, 1)
    if config is None:
        # Semente com a taxa combinada em agosto/2026 (R$ 1,00) — ajustável a
        # qualquer momento pelo dono do app (GET/PATCH /configuracoes).
        config = ConfiguracaoPlataforma(id=1, taxa_servico=1.00)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config
