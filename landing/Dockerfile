# Site institucional (opoint.com.br / www.opoint.com.br) — pedido do
# usuário, 2026-09-09: separar o domínio raiz (site) do app, que passou
# pra app.opoint.com.br. Estático puro, sem build step — só copia pro
# nginx, mesmo espírito do frontend/Dockerfile.prod.
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY favicon.svg /usr/share/nginx/html/favicon.svg
