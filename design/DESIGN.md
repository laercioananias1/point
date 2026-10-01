# OPoint — Guia de design

Slogan: **Sua arena no ponto.**

Este guia descreve o visual do OPoint. Toda tela nova ou refeita deve seguir estas regras. As telas de referência estão em `design/telas/` (arquivos `.dc.html`: leia o HTML e o bloco `<script>` para entender layout, dados de exemplo e comportamento).

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--azul` | `#0B2A3C` | Texto principal, menu lateral, botões primários, fundos escuros |
| `--azul-2` | `#123F59` | Item ativo do menu, cards dentro de fundo escuro |
| `--azul-3` | `#3F6E86` | Barras de ocupação médias, selos secundários |
| `--azul-claro` | `#9DB4C0` | Barras baixas, dados secundários |
| `--azul-gelo` | `#E2ECF0` | Selos informativos ("Ativo no app", "+2 adiantados") |
| `--limao` | `#D4F04A` | Destaque da marca: CTA principal, "em dia", seleção, bola do logo |
| `--areia` | `#F6F1E7` | Fundo das páginas |
| `--areia-2` | `#E9DFCB` | Fundos de seção alternados, chips, avatares |
| `--borda` | `#D8CDB6` | Bordas de inputs e botões secundários |
| `--linha` | `#EDE6D8` | Divisórias de tabelas e listas |
| `--branco` | `#FFFFFF` | Cards |
| `--texto-2` | `#2C4A5A` | Parágrafos |
| `--texto-3` | `#4F6B7A` | Legendas, labels de tabela |
| `--alerta-bg` / `--alerta` | `#F3D9CC` / `#7A2E10` | Vencido, falta check-in, erro |
| `--aviso-bg` / `--aviso` | `#FFF1C2` / `#5C4300` | Convite enviado, atenção |
| `--erro-forte` | `#C2552B` | Barras e marcadores de problema |
| `--ok` | `#2E8B57` | Ponto "online", check-in validado |

Nunca use o limão como cor de texto sobre fundo claro (contraste baixo). Texto sobre limão é sempre `--azul`.

## Tipografia

- Títulos e números grandes: **Bricolage Grotesque** 700/800, `letter-spacing: -0.03em` nos títulos grandes.
- Texto e interface: **DM Sans** 400/500/700.
- Google Fonts: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap`

| Uso | Tamanho |
|---|---|
| Título de página (painel) | 36px Bricolage 800 |
| Título de card/seção | 22px Bricolage 700 |
| Número de indicador (KPI) | 32–40px Bricolage 800 |
| Texto | 14–16px DM Sans |
| Label de tabela | 12px DM Sans 700, maiúsculas, `letter-spacing: 1px`, `--texto-3` |
| Legenda | 12–13px `--texto-3` |

## Forma e espaçamento

- Raios: cards 20–24px; cards grandes 28px; inputs 14px; botões e selos 999px (pílula).
- Página do painel: padding 32px; espaço entre blocos 20–24px.
- Cards: fundo branco, sem sombra, sem borda (a separação vem do fundo areia).
- Alvos de toque: mínimo 44px de altura.
- Ícones: traço (stroke) 2px, cantos arredondados, 20px. Nada de emoji.

## Componentes

- **Menu lateral (painel da arena):** 240px, fundo `--azul`, logo no topo, itens 15px com ícone; item ativo com fundo `--azul-2` e texto `--areia`; contadores em pílula limão. Rodapé com avatar e nome da arena.
- **Botão primário:** pílula `--azul` com texto `--areia`. **CTA de destaque:** pílula limão com texto `--azul`. **Secundário:** contorno 2px `--azul`, fundo transparente.
- **KPI:** card com label 14px, número grande e nota 13px. No máximo um KPI escuro e um limão por linha.
- **Tabela:** cabeçalho com labels pequenas em maiúsculas; linhas separadas por `--linha`; grid com colunas `minmax(0, Nfr)`.
- **Selo de status (pílula 12px 700):** em dia = limão; informativo = `--azul-gelo`; atenção = aviso; problema = alerta.
- **Barra de progresso:** trilho `--linha` 8px, preenchimento `--azul` (≥ 100%), `--azul-3` (≥ 75%), `--azul-claro` (abaixo).
- **Painel de formulário:** card branco com borda 2px `--azul` ao lado da lista, título 24px, botão de fechar redondo 44px, campos com label acima.
- **Chips de seleção:** pílula com borda `--borda`; selecionado = fundo limão e borda `--azul`.
- **Interruptor (toggle):** trilho 48×28, ligado `--azul`, desligado `--borda`.
- **Celular (aluno/professor):** cabeçalho `--azul` com cantos inferiores 28px, seletor de arena em pílula `--azul-2`, conteúdo em cards brancos 18–20px.

## Logo

Arquivos em `design/logo/`. Use `opoint-logo-colorido.svg` em fundo claro e `opoint-logo-negativo.svg` em fundo escuro. O ícone do app é `opoint-icone-app.png`. Não distorça, não troque as cores e não coloque o logo colorido sobre o limão.

## Regras de negócio que as telas refletem

- Presença na aula é confirmada pelo **professor** na chamada.
- Check-ins do Wellhub/TotalPass chegam por **webhook** e não ficam ligados a uma aula: no fim do mês, **quantidade de check-ins = quantidade de aulas** (saldo = check-ins − aulas).
- Alunos e professores entram por **convite**, com **e-mail e senha**; a mesma conta pode estar em **várias arenas**, com papéis diferentes.
- Aula experimental: o aluno pede, o **professor confirma**.
- TotalPass aparece como "em breve".
