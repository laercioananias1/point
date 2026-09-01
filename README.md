# OPoint

App de gestão de aulas de esporte de praia (beach tennis, futevôlei e afins) —
Points (arenas), professores e alunos. MVP web em construção; app mobile entra
depois de validado.

Plano de arquitetura completo: ver o artefato publicado na conversa (stack,
modelo de dados, roadmap de construção, decisões em aberto).

## Stack

- **Backend:** Python · FastAPI + SQLAlchemy 2.0 · MySQL · Alembic
- **Frontend:** React + TypeScript (Vite)
- **Local:** Docker Compose
- **Produção:** VPS próprio (mesmo servidor de outros serviços do TaskHero),
  Docker Compose + nginx/Traefik do host — ver [DEPLOY.md](DEPLOY.md). Deploy
  manual por enquanto, sem CI/CD (pedido do usuário, 2026-08-30).

## Rodando localmente

```bash
cp .env.example .env
docker compose up
```

- API: http://localhost:8001 (docs interativos em `/docs`) — porta 8001 porque
  a 8000 costuma estar ocupada por outro serviço local; ajuste em
  `docker-compose.yml` se quiser outra porta
- Painel web: http://localhost:5173
- MySQL: `localhost:3307` (usuário `root`, senha de `.env`) — porta 3307 no
  host porque a 3306 costuma estar ocupada por outro serviço local; ajuste em
  `docker-compose.yml` se quiser outra porta

Na primeira vez, aplique as migrations e crie o usuário super_admin inicial:

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m app.scripts.seed
```

O script de seed imprime o celular e a senha temporária do super_admin — troque
antes de qualquer coisa que não seja ambiente local.

## Estrutura

```
point/
├── docker-compose.yml
├── backend/            # FastAPI — app/models, schemas, routers, alembic/
├── frontend/           # React + TS (Vite) — src/pages por perfil
└── infra/              # (a criar) Terraform/CDK para AWS
```

## O que já está implementado (fatia vertical do MVP núcleo)

- Autenticação por celular/e-mail + senha, JWT com papel (role)
- Cadastro de Point (dono do app) e controle de formas de pagamento habilitadas
- Cadastro global de Professor e Aluno
- Vínculo Professor↔Point com fluxo de aprovação (pendente → ativo/recusado),
  isolado por Point (um admin nunca vê vínculos de outro Point)
- Turma dentro de um vínculo ativo, com visão consolidada do professor entre
  todos os seus Points
- Matrícula com aprovação obrigatória (em_análise → ativa/recusada), isolada
  por Point

## O que ainda falta (próximos passos do roadmap)

- Cobrança Pix/dinheiro e geração de check-in "presumido"
- Cancelamento e crédito de reposição
- Fechamento mensal (fatura de taxa de serviço + relatório de repasse)
- Dashboards (admin do Point e dono do app)
- Reserva de vaga em tempo real / lista de espera
- Integração TotalPass/Wellhub (Fase 2 — fora do MVP núcleo)

Várias dessas etapas dependem de decisões de negócio ainda em aberto (valor da
taxa de serviço, SLA de aprovação de matrícula, regras de reposição) — ver a
seção 10 do plano de arquitetura antes de começar.

## Testes

```bash
docker compose exec api pytest
```
