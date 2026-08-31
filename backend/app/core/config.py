from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Peças separadas da conexão com o banco, não a URL inteira pronta
    # (pedido do usuário, 2026-08-30: primeiro deploy em produção pegou um
    # bug real — DB_ROOT_PASSWORD com "#" quebrava o parsing quando a URL
    # era montada crua por interpolação de string no docker-compose.yml,
    # porque "#" e outros caracteres especiais precisam de percent-encoding
    # dentro de uma URL, e uma senha comum não vem assim. `database_url`
    # abaixo monta a URL em Python via sqlalchemy.engine.URL.create, que
    # faz esse encoding certo sozinho — funciona com qualquer senha, não só
    # as "seguras pra URL".
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "root"
    db_name: str = "point"

    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12h

    # E-mail de convite via Resend (pedido do usuário, 2026-08-20). Sem
    # resend_api_key configurada, o envio vira um log no console em vez de
    # falhar — dá pra testar o fluxo de convite sem conta no Resend.
    resend_api_key: str = ""
    resend_from: str = "Point <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:5173"

    # Integração TotalPass (pedido do usuário, 2026-08-25: "quero fazer
    # integração com totalpass... aceitar os checkins"). partner_api_key é
    # da plataforma inteira — conseguido com o time de parceiros da
    # TotalPass, não é self-service (ver app/services/totalpass.py). O
    # place_api_key é POR Point (Point.place_api_key, cada Point pega o
    # dele no portal deles). Base URL aponta pro staging por padrão de
    # propósito — nunca bater em produção sem trocar isso explicitamente
    # no .env quando o Point realmente for pra produção.
    totalpass_partner_api_key: str = ""
    totalpass_base_url: str = "https://booking-api.staging.totalpass.com"

    # Origens liberadas pro CORS, separadas por vírgula (pedido do usuário,
    # 2026-08-30: deploy em produção) — em dev é só o Vite local; em
    # produção, o domínio de verdade do painel (ex.:
    # "https://point.taskhero.com.br"). Nunca deixa aberto pra qualquer
    # origem (allow_credentials=True não permite "*" mesmo se quisesse).
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origem.strip() for origem in self.cors_origins.split(",") if origem.strip()]

    @property
    def database_url(self) -> str:
        from sqlalchemy.engine import URL

        return URL.create(
            "mysql+pymysql",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
