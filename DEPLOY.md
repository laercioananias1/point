# Deploy em produção (point.taskhero.com.br)

Passo a passo pra rodar manualmente no VPS, assumindo Docker + Docker Compose
já instalados e um nginx (ou Traefik) já rodando no host cuidando de outros
subdomínios do TaskHero.

## 1. Primeira vez no servidor

```bash
git clone https://github.com/laercioananias1/point.git
cd point
cp .env.production.example .env.production
# edite .env.production com os valores reais (senha do banco, JWT_SECRET
# aleatório de verdade — `openssl rand -hex 32` —, credencial do Resend
# se for usar e-mail de convite)
```

## 2. Subir os containers

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Isso sobe três serviços, todos só em `127.0.0.1` (não acessíveis direto da
internet — o nginx do host é quem expõe):

- `db` (MySQL) — sem porta publicada, só a rede interna do compose acessa
- `api` (FastAPI) — `127.0.0.1:8001`
- `web` (painel, build estático servido por nginx dentro do container) —
  `127.0.0.1:8002`

## 3. Migrations + primeiro usuário

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml exec api python -m app.scripts.seed
```

O seed cria o dono do app (`laercio.ananias@gmail.com`) e as contas de teste
(admin/professor/aluno) que já existiam no ambiente de dev — pedido do
usuário, 2026-08-30: "em produção pode criar tb os usuários de testes que
foram criados aqui". **Atenção**: essas contas de teste nascem com a senha
padrão `teste123`, pública no código-fonte (`backend/app/scripts/seed.py`) —
num domínio de verdade, exposto na internet, isso é uma conta com senha
conhecida por qualquer um que veja o repositório. Pelo menos troque a senha
delas depois de criadas (ou apague as que não forem usar de verdade), e
troque a sua própria (dono do app) assim que logar.

O script é idempotente — rodar de novo não duplica nem quebra nada, só pula
quem já existe.

## 4. Configurar o nginx do host

`point.taskhero.com.br` inteiro num domínio só: `/api/` vai pra API (com o
prefixo removido antes de chegar no FastAPI, que não conhece esse prefixo),
o resto vai pro painel. Adicione um server block (ajuste os `proxy_pass`
se preferir portas diferentes de 8001/8002, e o bloco de SSL conforme o
que já for usado nos outros subdomínios):

```nginx
server {
    listen 443 ssl http2;
    server_name point.taskhero.com.br;

    # ssl_certificate / ssl_certificate_key — mesmo esquema já usado nos
    # outros subdomínios do TaskHero (certbot, etc.)

    location /api/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name point.taskhero.com.br;
    return 301 https://$host$request_uri;
}
```

Se usar Traefik em vez de nginx, o equivalente é dois routers (um pra
`PathPrefix(/api)` com um middleware `StripPrefix` de `/api`, apontando pro
serviço da API; outro catch-all apontando pro serviço do painel) — me avisa
se for esse o caso que eu escrevo os labels certos.

Com `VITE_API_URL=https://point.taskhero.com.br/api` no `.env.production`
(já é o padrão do `.env.production.example`), o painel já sabe bater nesse
caminho — não precisa de outro subdomínio nem outra entrada de DNS.

## 5. Atualizar depois de um `git push`

```bash
cd point
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

(o `up -d --build` já reconstrói só o que mudou; a migration é segura rodar
sempre, mesmo sem mudança de schema — não faz nada se já estiver em dia)

## Persistência

- **Banco**: volume nomeado `db_data` — sobrevive a `up -d --build`, some só
  com `docker compose down -v` (evite usar `-v` em produção).
- **Fotos/banners/logo enviados** (`app/services/uploads.py`): volume nomeado
  `uploads_data` — mesma regra, sobrevive a rebuild da imagem da API.

## Ainda não incluído aqui

- Backup automático do banco (por enquanto, `docker compose exec db
  mysqldump ...` manual, ou configure o backup que já usam pros outros
  serviços do TaskHero nesse VPS).
- CI/CD (deploy ainda é manual, por pedido do usuário — "no servidor eu subo
  manualmente").
