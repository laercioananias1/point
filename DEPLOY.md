# Deploy em produção (opoint.com.br)

Passo a passo pra rodar manualmente no VPS, assumindo Docker + Docker Compose
já instalados. Domínio próprio (`opoint.com.br`, registrado 2026-09), mas
no mesmo servidor compartilhado com outros serviços do TaskHero (era
`point.taskhero.com.br` até o rebrand pra OPoint, 2026-09).

**Importante sobre o nginx desse servidor**: quem expõe as portas 80/443 pra
internet **não** é um nginx tradicional em `/etc/nginx` do host — é o nginx
que já roda **dentro de outro container** (`adsops-frontend-1`, de um
projeto não relacionado que chegou primeiro nessas portas). Ver seção 4 pra
como isso funciona na prática.

## 0. Servidor compartilhado com pouca RAM — configure swap primeiro

Se esse VPS já roda outra stack (esse é o caso — `adsops`, com o próprio
MySQL) e tem pouca memória (esse servidor tem ~1.9GB), configure um
swapfile **antes** de subir os containers — sem isso, o MySQL do Point
entra em loop de restart sob pressão de memória (aconteceu no primeiro
deploy: `RestartCount=4`, sistema com só 68Mi livres, 0B de swap):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # confirma 2.0G de swap
```

O `docker-compose.prod.yml` também já reduz o footprint padrão do MySQL
(`innodb_buffer_pool_size`, `performance_schema` desligado, menos
conexões) — ajuda, mas não substitui o swap como rede de segurança.

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

## 4. DNS + nginx (rodando dentro do container `adsops-frontend-1`)

### 4.1 Apontar o DNS

No painel onde `opoint.com.br` foi registrado, crie um registro **A**
apontando pro IP público desse VPS (e o mesmo pra `www.opoint.com.br` se for
usar, ou um CNAME pro domínio raiz). Espere propagar antes de pedir o
certificado (seção 4.4) — `dig opoint.com.br` deve devolver o IP do servidor.

### 4.2 Conectar o container do nginx à rede do Point

O nginx que atende 80/443 roda dentro de `adsops-frontend-1` (projeto
não relacionado). Pra ele conseguir falar com `point-api-1`/`point-web-1`
pelo nome do container (em vez de depender de `127.0.0.1:PORTA`, que dentro
de um container sibling não bate no host), conecte-o à rede do compose do
Point (se ainda não estiver conectado):

```bash
docker network connect point_default adsops-frontend-1
```

### 4.3 Adicionar o server block

A config desse nginx fica em `/etc/nginx/conf.d/*.conf` **dentro** do
container (não é bind mount do host — só os volumes do certbot são). Crie
o arquivo direto no container rodando:

```bash
docker exec -i adsops-frontend-1 sh -c 'cat > /etc/nginx/conf.d/opoint.conf' << 'EOF'
server {
    listen 80;
    server_name opoint.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name opoint.com.br;

    ssl_certificate /etc/letsencrypt/live/opoint.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opoint.com.br/privkey.pem;

    location /api/ {
        proxy_pass http://point-api-1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://point-web-1:80/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

O bloco 443 só funciona depois que o certificado existir (próximo passo) —
`nginx -t`/`reload` vai reclamar até lá, é esperado.

### 4.4 Emitir o certificado (Let's Encrypt / certbot)

O host não tem `certbot` instalado — roda um container avulso, reaproveitando
os volumes de certbot que o `adsops-frontend-1` já usa (`_data` é o caminho
real por trás dos volumes nomeados; confirme com
`docker volume inspect adsops_certbot_www adsops_certbot_conf`):

```bash
docker run --rm \
  -v adsops_certbot_www:/var/www/certbot \
  -v adsops_certbot_conf:/etc/letsencrypt \
  certbot/certbot certonly --webroot -w /var/www/certbot -d opoint.com.br
```

Depois, recarregue o nginx pra ele pegar o certificado novo e o server block:

```bash
docker exec adsops-frontend-1 nginx -t
docker exec adsops-frontend-1 nginx -s reload
```

Teste: `curl -I https://opoint.com.br/api/health` deve responder 200 com
`{"api":"ok","database":"ok"}`.

### 4.5 Limitação conhecida (ainda não resolvida)

Esse arquivo `/etc/nginx/conf.d/opoint.conf` foi escrito direto na camada
gravável do container `adsops-frontend-1` — **não sobrevive** se a imagem
desse projeto (não relacionado) for reconstruída algum dia. O jeito certo
seria achar o `nginx.conf`/Dockerfile de origem do projeto `adsops` no
servidor e adicionar esse bloco lá de forma permanente, mas isso não foi
feito ainda (fora do escopo do Point). Se o site cair sem motivo aparente
depois de um deploy do `adsops`, é o primeiro lugar pra checar — só repetir
o passo 4.3 resolve.

Com `VITE_API_URL=https://opoint.com.br/api` no `.env.production` (já é o
padrão do `.env.production.example`), o painel já sabe bater nesse
caminho — não precisa de outro domínio nem outra entrada de DNS.

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
