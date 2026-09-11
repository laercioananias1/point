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
    resend_from: str = "OPoint <onboarding@resend.dev>"
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

    # Notificações via WhatsApp (pedido do usuário, 2026-09-11: "quero
    # fazer integração com whatsapp para enviar notificações de
    # agendamento de aula, convites, etc") — Meta Cloud API direta (não é
    # um BSP terceiro). access_token e phone_number_id vêm do Business
    # Manager → WhatsApp → Configuração da API. Mensagem iniciada pela
    # empresa (convite) exige um "message template" pré-aprovado pela Meta
    # — ver services/whatsapp.py. Sem access_token configurado, o envio
    # vira um log no console em vez de falhar (mesmo padrão do e-mail via
    # Resend) — dá pra testar o resto do fluxo sem credencial.
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    # Versão da Graph API — a Meta depreca versões antigas (~2 anos de
    # suporte); revise esse valor periodicamente contra
    # developers.facebook.com/docs/graph-api/changelog.
    whatsapp_api_base_url: str = "https://graph.facebook.com/v21.0"
    # Um template por tipo de convite (pedido do usuário, 2026-09-11: "a
    # variavel 3 ser um botao do modelo") — o botão de URL tem a parte fixa
    # do link aprovada DENTRO do template na Meta, e cada tipo de convite
    # aceita num caminho diferente (/convite/, /convite-vinculo/,
    # /convite-admin/), então não dá pra reaproveitar um template só como
    # antes (quando o link era texto livre no corpo). Ver
    # services/whatsapp.py.
    whatsapp_template_convite_aluno: str = "invite_point"
    whatsapp_template_convite_professor: str = "convite_professor"
    whatsapp_template_convite_admin: str = "convite_admin"
    # Cancelamento de aula pelo professor/admin (pedido do usuário,
    # 2026-09-11: "vamos fazer uma notificacao para cencalemento de aula
    # pelo professor") — avisa por WhatsApp quem tinha aula justamente na
    # data cancelada (mesma lista que hoje recebe o crédito de reposição,
    # ver routers/turmas.py::remover_turma). Só texto, sem botão — nada
    # pra clicar, é aviso mesmo.
    whatsapp_template_cancelamento_aula: str = "cancelamento_aula"

    # Origens liberadas pro CORS, separadas por vírgula (pedido do usuário,
    # 2026-08-30: deploy em produção) — em dev é só o Vite local; em
    # produção, o domínio de verdade do painel (ex.:
    # "https://opoint.com.br"). Nunca deixa aberto pra qualquer
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
