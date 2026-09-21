import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api, urlArquivo } from "../api/client";
import type { PointLogo } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { aplicarCorDestaque } from "../lib/cor";
import { BotaoTema } from "./BotaoTema";
import { LogoMark } from "./LogoMark";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Dono do app",
  admin_point: "Admin do Point",
  professor: "Professor",
  aluno: "Aluno",
};

// Um prefixo de rota por área — pedido do usuário, 2026-08-26: uma conta
// pode ter mais de um papel agora (dono do Point que também é professor),
// então a barra de abas não pode mais depender de um "papel principal"
// fixo. Em vez disso, olha em qual ÁREA a rota atual está e mostra as abas
// dessa área — quem navega de /admin-point pra /professor (ver "Trocar de
// área" nas telas de Perfil) só troca de barra, sem precisar logar de novo.
// A chave é a mesma usada em NAV_LINKS/HEADER_ACTION/ROLE_LABEL; o prefixo
// de rota é sempre igual à chave, exceto admin_point (rota tem hífen).
const PREFIXO_ROTA: Record<string, string> = {
  admin_point: "/admin-point",
  professor: "/professor",
  aluno: "/aluno",
  super_admin: "/dono-app",
};

function areaDaRota(pathname: string): string | null {
  return (
    Object.keys(PREFIXO_ROTA).find((area) => {
      const prefixo = PREFIXO_ROTA[area];
      return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
    }) ?? null
  );
}

// Ícone + rótulo curto (a barra inferior não tem espaço pro rótulo longo do
// menu de topo) — pedido do usuário, 2026-08-25: "layout pra ficar como um
// aplicativo no celular".
const NAV_LINKS: Record<string, { to: string; label: string; tab: string; icon: IconName }[]> = {
  // Aluno e Professor saíram daqui (pedido do usuário, 2026-08-26: "alunos
  // e professor também vira botões") — mesmo tratamento de Turmas antes:
  // viram caixinha na Início, em vez de aba fixa no rodapé.
  admin_point: [
    { to: "/admin-point", label: "Início", tab: "Início", icon: "home" },
    { to: "/admin-point/agenda", label: "Agenda", tab: "Agenda", icon: "calendar" },
    // Faturamento saiu daqui (pedido do usuário, 2026-08-30: "faturamento
    // vai também pra dentro de Ver mais") — mesmo tratamento de Turmas/
    // Aluno/Professor antes: virou botão dentro de Ver mais.
    // Era o ícone de engrenagem solto no cabeçalho (ver HEADER_ACTION,
    // removido) — virou aba própria (pedido do usuário, 2026-08-30: "esse
    // botão de configurações vamos transformar em um botão também no
    // rodapé chamado Ver Mais... assim fica um espaço pra criar mais
    // funcionalidades organizado").
    { to: "/admin-point/mais", label: "Ver mais", tab: "Ver mais", icon: "list" },
    { to: "/admin-point/perfil", label: "Perfil", tab: "Perfil", icon: "user" },
  ],
  aluno: [
    { to: "/aluno", label: "Início", tab: "Início", icon: "home" },
    { to: "/aluno/agenda", label: "Agenda", tab: "Agenda", icon: "calendar" },
    { to: "/aluno/perfil", label: "Perfil", tab: "Perfil", icon: "user" },
  ],
  // Turmas saiu daqui (pedido do usuário, 2026-08-26: "faz um botão também
  // de Turmas e tira ele do rodapé") — vira uma caixinha na Início, igual
  // Ocupação de turma.
  professor: [
    { to: "/professor", label: "Início", tab: "Início", icon: "home" },
    { to: "/professor/agenda", label: "Agenda", tab: "Agenda", icon: "calendar" },
    { to: "/professor/perfil", label: "Perfil", tab: "Perfil", icon: "user" },
  ],
  super_admin: [
    { to: "/dono-app", label: "Início", tab: "Início", icon: "home" },
    { to: "/dono-app/points", label: "Points", tab: "Points", icon: "grid" },
    { to: "/dono-app/perfil", label: "Perfil", tab: "Perfil", icon: "user" },
  ],
};

// Menu lateral no desktop (pedido do usuário, 2026-09-20: "quero o layout
// com os menus na lateral") — mesmo destino das abas do celular, mas com
// tudo agrupado e visível de uma vez em vez de esconder atrás de "Ver
// mais". Abaixo de 900px continua valendo a barra de abas/menu do topo.
type ItemMenu = { to: string; label: string; icon: IconName; end?: boolean };
type GrupoMenu = { titulo: string | null; itens: ItemMenu[] };

const SIDEBAR: Record<string, GrupoMenu[]> = {
  admin_point: [
    {
      titulo: null,
      itens: [
        { to: "/admin-point", label: "Início", icon: "home", end: true },
        { to: "/admin-point/agenda", label: "Agenda", icon: "calendar" },
      ],
    },
    {
      titulo: "Pessoas",
      itens: [
        { to: "/admin-point/aluno", label: "Alunos", icon: "users" },
        { to: "/admin-point/professor", label: "Professores", icon: "user-check" },
        { to: "/admin-point/experimental", label: "Aula experimental", icon: "user-plus" },
      ],
    },
    {
      titulo: "Quadras e aulas",
      itens: [
        { to: "/admin-point/turmas", label: "Turmas", icon: "grid" },
        { to: "/admin-point/ocupacao", label: "Ocupação", icon: "chart" },
        { to: "/admin-point/configuracoes/quadras", label: "Quadras", icon: "pin" },
        { to: "/admin-point/configuracoes/modalidades", label: "Modalidades", icon: "list" },
        { to: "/admin-point/configuracoes/categorias", label: "Categorias", icon: "list" },
        { to: "/admin-point/configuracoes/tipos-turma", label: "Tipos de turma", icon: "repeat" },
      ],
    },
    {
      titulo: "Financeiro",
      itens: [
        { to: "/admin-point/cobrancas", label: "Cobranças", icon: "dollar" },
        { to: "/admin-point/caixa", label: "Caixa", icon: "chart" },
        { to: "/admin-point/relatorios", label: "Relatórios", icon: "list" },
        { to: "/admin-point/configuracoes/planos", label: "Planos", icon: "ticket" },
      ],
    },
    {
      titulo: "Configurações",
      itens: [
        { to: "/admin-point/meu-point", label: "Meu Point", icon: "home" },
        { to: "/admin-point/configuracoes/horarios", label: "Horários", icon: "calendar" },
        { to: "/admin-point/configuracoes/prazos", label: "Prazos", icon: "clock" },
        { to: "/admin-point/configuracoes/feriados", label: "Feriados", icon: "flag" },
        { to: "/admin-point/ajuda", label: "Ajuda", icon: "help" },
        { to: "/admin-point/perfil", label: "Perfil", icon: "user" },
      ],
    },
  ],
  professor: [
    {
      titulo: null,
      itens: [
        { to: "/professor", label: "Início", icon: "home", end: true },
        { to: "/professor/agenda", label: "Agenda", icon: "calendar" },
      ],
    },
    {
      titulo: "Aulas",
      itens: [
        { to: "/professor/turmas", label: "Turmas", icon: "grid" },
        { to: "/professor/ocupacao", label: "Ocupação", icon: "chart" },
        { to: "/professor/experimental", label: "Aula experimental", icon: "user-plus" },
      ],
    },
    {
      titulo: "Conta",
      itens: [
        { to: "/professor/ajuda", label: "Ajuda", icon: "help" },
        { to: "/professor/perfil", label: "Perfil", icon: "user" },
      ],
    },
  ],
  aluno: [
    {
      titulo: null,
      itens: [
        { to: "/aluno", label: "Início", icon: "home", end: true },
        { to: "/aluno/agenda", label: "Agenda", icon: "calendar" },
        { to: "/aluno/creditos", label: "Créditos", icon: "ticket" },
        { to: "/aluno/perfil", label: "Perfil", icon: "user" },
      ],
    },
  ],
  super_admin: [
    {
      titulo: null,
      itens: [
        { to: "/dono-app", label: "Início", icon: "home", end: true },
        { to: "/dono-app/points", label: "Points", icon: "grid" },
        { to: "/dono-app/perfil", label: "Perfil", icon: "user" },
      ],
    },
  ],
};

export type IconName =
  | "home"
  | "chart"
  | "settings"
  | "logout"
  | "calendar"
  | "user"
  | "grid"
  | "user-check"
  | "user-plus"
  | "users"
  | "x"
  | "ticket"
  | "pin"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "help"
  | "clock"
  | "mail"
  | "link"
  | "pause"
  | "refresh"
  | "check-circle"
  | "list"
  | "repeat"
  | "x-circle"
  | "flag"
  | "bell"
  | "edit"
  | "trash"
  | "message"
  | "check"
  | "dollar";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M9 22V12h6v10" />
      </>
    ),
    chart: <path d="M4 20V10M12 20V4M20 20v-7" />,
    // Engrenagem de verdade (pedido do usuário, 2026-08-26: "deixa o botão
    // de configurações com o símbolo de engrenagem") — o que tinha antes
    // era um ícone de sliders/filtros, não uma engrenagem.
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17 21 12 16 7M21 12H9" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
    "user-check": (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="m17 11 2 2 4-4" />
      </>
    ),
    "user-plus": (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6M23 11h-6" />
      </>
    ),
    // Fecha/volta de uma tela cheia aberta a partir de uma caixinha
    // (pedido do usuário, 2026-08-26) — mesmo "X" circular do exemplo.
    x: <path d="M18 6 6 18M6 6l12 12" />,
    // Crédito de reposição (pedido do usuário, 2026-08-26: home do aluno
    // parecida com app de academia) — formato de ticket/vale, não cartão
    // de pagamento (não é dinheiro, é aula a repor).
    ticket: (
      <>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
        <path d="M9 6v2M9 16v2M9 11v2" />
      </>
    ),
    // Local do Point na home do aluno (pedido do usuário, 2026-08-26).
    pin: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    // Ação "adicionar" no cabeçalho de uma tela cheia (pedido do usuário,
    // 2026-08-26) — ex.: "Comprar" em Meus créditos.
    plus: <path d="M12 5v14M5 12h14" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    // Voltar de uma tela cheia que veio de outra tela dentro do fluxo
    // (pedido do usuário, 2026-08-31: "troque esse X de fechar pelo
    // simbolo < de voltar" — em "Reagendar crédito", que substitui a tela
    // anterior em vez de fechar uma caixinha, o "<" comunica melhor).
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    // Avançar/entrar numa tela (pedido do usuário, 2026-09-01: "ajusta em
    // todo o app essa setinha de avancar, deixa ela igual a seta de
    // voltar das telas de cadastro") — mesmo traço do chevron-left,
    // espelhado, no lugar da seta "→" em texto que os action-card/
    // item-card-clickable usavam antes.
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    // Botão de Ajuda no cabeçalho (pedido do usuário, 2026-09-01: "não fica
    // melhor se for online no app? tem um botão ajuda?") — leva pra
    // /admin-point/ajuda ou /professor/ajuda, ver Layout abaixo.
    help: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    mail: (
      <>
        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="m22 6-10 7L2 6" />
      </>
    ),
    link: (
      <>
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
        <path d="M8 12h8" />
      </>
    ),
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </>
    ),
    refresh: (
      <>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </>
    ),
    "check-circle": (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
    // "Ver mais" (pedido do usuário, 2026-09-01: "Ver mais e Prazos estão
    // com o mesmo ícone [engrenagem]... Ver mais acho que deveria ser um
    // ícone de list") — lista mesmo, não engrenagem: essa aba não é
    // "configurações", é um hub de atalhos.
    list: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </>
    ),
    // Marcador de "aula recorrente/mensal" no mini-calendário da agenda do
    // aluno (pedido do usuário, 2026-09-01: "no lugar do pontinho da pra
    // criar ícones como: aula recorrente ou mensal, aula reposição ou
    // aula avulsa") — o de avulsa/reposição reaproveita o ícone "ticket"
    // que já representa crédito de reposição no resto do app.
    repeat: (
      <>
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
    // Aula cancelada por força maior no calendário (pedido do usuário,
    // 2026-09-01: "aparecer no calendário com um ícone tb de
    // cancelamento e mostrar motivo").
    "x-circle": (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
    // Feriado no calendário (pedido do usuário, 2026-09-01: "faz um
    // ícone diferenciado para feriado, não vamos misturar com dia que
    // tem aula cancelada") — separado do "x-circle" de cancelamento.
    flag: (
      <>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </>
    ),
    // Sininho de notificações no cabeçalho (pedido do usuário, 2026-09-11:
    // "esse tipo de msg é bom tb ter no app... já tava previsto lá no
    // início fazermos uma tela de notificações").
    bell: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    // Ações por linha na tela de Cobranças (pedido do usuário, 2026-09-20).
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </>
    ),
    message: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />,
    check: <polyline points="20 6 9 17 4 12" />,
    dollar: (
      <>
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, estaComoSuporte, sairDoSuporte } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const area = areaDaRota(location.pathname);
  const links = area ? (NAV_LINKS[area] ?? []) : [];
  const grupos = area ? (SIDEBAR[area] ?? []) : [];
  const rotuloArea = area ? (ROLE_LABEL[area] ?? area) : "";

  // Logomarca do Point no canto esquerdo (pedido do usuário, 2026-08-30:
  // "coloque também um ícone (logomarca do point)... precisa também ser
  // mostrado a logomarca no canto esquerdo", pra todo mundo — admin,
  // professor, aluno) — GET /points/meu-logo resolve o Point certo pra
  // qualquer papel; sem Point (dono do app) ou sem logo cadastrado, cai
  // na marca genérica do app. Busca uma vez por sessão de usuário, não a
  // cada navegação (o logo não muda entre telas).
  const [pointLogo, setPointLogo] = useState<PointLogo | null>(null);
  useEffect(() => {
    if (!user) {
      setPointLogo(null);
      aplicarCorDestaque(null);
      return;
    }
    api
      .get<PointLogo>("/points/meu-logo")
      .then((res) => {
        setPointLogo(res);
        // Cor de destaque do Point (pedido do usuário, 2026-09-14) — mesma
        // resolução de "qual Point" que já serve o logo, então aplica
        // junto, sem duplicar a busca.
        aplicarCorDestaque(res.cor_destaque);
      })
      .catch(() => {
        setPointLogo(null);
        aplicarCorDestaque(null);
      });
  }, [user]);

  // Selo de não lidas no sininho (pedido do usuário, 2026-09-11: "esse
  // tipo de msg é bom tb ter no app... já tava previsto lá no início
  // fazermos uma tela de notificações") — refaz a contagem a cada troca
  // de tela (cobre tanto "chegou notificação nova" quanto "acabei de ler
  // na tela de Notificações", sem precisar de um estado global só pra isso).
  const [naoLidas, setNaoLidas] = useState(0);
  useEffect(() => {
    if (!user) {
      setNaoLidas(0);
      return;
    }
    api
      .get<{ nao_lidas: number }>("/notificacoes/contagem-nao-lidas")
      .then((res) => setNaoLidas(res.nao_lidas))
      .catch(() => {});
  }, [user, location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // "Ver mais" abre o menu lateral (pedido do usuário, 2026-09-20: "o Ver
  // mais também abre o menu na lateral") — abaixo de 900px a barra lateral
  // vira uma gaveta que desliza por cima; no desktop ela já está sempre
  // visível, então isso só importa em tela estreita.
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [menuAberto]);
  const ROTA_VER_MAIS = "/admin-point/mais";

  // Faixa de modo suporte (pedido do usuário, 2026-08-30: dono do app
  // "entrar como" o admin de um Point, com jeito de voltar depois) —
  // fixa em toda tela enquanto durar, pra nunca esquecer que a sessão
  // atual não é a própria.
  async function handleSairDoSuporte() {
    await sairDoSuporte();
    navigate("/dono-app");
  }

  return (
    <div className={grupos.length > 0 ? "app-shell app-shell-lateral" : "app-shell"}>
      {grupos.length > 0 && (
        <>
        {menuAberto && (
          <div className="app-sidebar-fundo" onClick={() => setMenuAberto(false)} aria-hidden="true" />
        )}
        <aside className={menuAberto ? "app-sidebar aberto" : "app-sidebar"}>
          <div className="app-sidebar-marca">
            {pointLogo?.logo ? (
              <img
                src={urlArquivo(pointLogo.logo)}
                alt={pointLogo.nome ?? "Logo do Point"}
                className="app-sidebar-logo"
              />
            ) : (
              <LogoMark size={34} />
            )}
            <span className="app-sidebar-marca-texto">
              <span className="app-sidebar-nome" title={pointLogo?.nome ?? "OPoint"}>
                {pointLogo?.nome ?? "OPoint"}
              </span>
            </span>
          </div>
          <nav className="app-sidebar-nav">
            {grupos.map((grupo, i) => (
              <div className="app-sidebar-grupo" key={i}>
                {grupo.titulo && <span className="app-sidebar-titulo">{grupo.titulo}</span>}
                {grupo.itens.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? "app-sidebar-link active" : "app-sidebar-link"
                    }
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <button type="button" className="app-sidebar-sair" onClick={handleLogout}>
            <Icon name="logout" size={18} />
            Sair da conta
          </button>
        </aside>
        </>
      )}
      <div className="app-sticky-top">
        {estaComoSuporte && (
          <div className="app-suporte-faixa">
            <span>Modo suporte — você está como {user?.nome}.</span>
            <button type="button" onClick={handleSairDoSuporte}>
              Voltar pra minha conta
            </button>
          </div>
        )}
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-brand">
              {pointLogo?.logo ? (
                <img
                  src={urlArquivo(pointLogo.logo)}
                  alt={pointLogo.nome ?? "Logo do Point"}
                  className="app-brand-logo"
                />
              ) : (
                <LogoMark />
              )}
              {/* Nome do Point no lugar de "OPoint" fixo (pedido do
                  usuário, 2026-09-14: "dar destaque para o logo de cada
                  point") — sem Point resolvido (dono do app), continua
                  mostrando a marca genérica do sistema. */}
              {pointLogo?.nome ?? "OPoint"}
            </span>
            {links.length > 0 && (
              <nav className="app-nav">
                {links.map((link) =>
                  link.to === ROTA_VER_MAIS ? (
                    <button
                      key={link.to}
                      type="button"
                      className={menuAberto ? "app-nav-link active" : "app-nav-link"}
                      onClick={() => setMenuAberto(true)}
                    >
                      {link.label}
                    </button>
                  ) : (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end
                      className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                    >
                      {link.label}
                    </NavLink>
                  ),
                )}
              </nav>
            )}
          </div>
          {user && (
            <div className="app-user">
              <span className="app-user-text">
                <span className="app-user-role">{rotuloArea}</span>
                <span className="app-user-name">{user.nome}</span>
              </span>
              <BotaoTema />
              {area && (
                <button
                  type="button"
                  className="app-header-icon-btn app-avisos-btn"
                  onClick={() => navigate(`${PREFIXO_ROTA[area]}/notificacoes`)}
                  aria-label={naoLidas > 0 ? `Notificações — ${naoLidas} não lida(s)` : "Notificações"}
                >
                  {/* Texto, não Icon/SVG (pedido do usuário, 2026-09-11:
                      depois de 3 tentativas — contorno fino, fundo sólido,
                      path exato do Feather (o mesmo "chevron-left" que
                      funciona bem ao lado, nesta mesma tela) — o sino
                      seguia invisível mesmo sem cache, mesmo com nome de
                      classe genérico. Suspeita: bloqueador reconhecendo o
                      desenho específico de sino de notificação (é o SVG de
                      "avise-me" mais usado da web). Emoji como texto sai
                      do jogo de SVG por completo, mesmo truque já provado
                      no "?" do botão de Ajuda ao lado. */}
                  <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                    🔔
                  </span>
                  {naoLidas > 0 && (
                    <span className="app-avisos-selo" aria-hidden="true">
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </button>
              )}
              {/* Botão de Ajuda (pedido do usuário, 2026-09-01: "não fica
                  melhor se for online no app? tem um botão ajuda?") — só pra
                  quem tem uma tela de Ajuda escrita (admin e professor por
                  enquanto); sempre visível, não depende de estar na aba
                  certa, porque quem precisa de ajuda pode estar em
                  qualquer tela. */}
              {(area === "admin_point" || area === "professor") && (
                <button
                  type="button"
                  className="app-help-btn"
                  onClick={() => navigate(`${PREFIXO_ROTA[area]}/ajuda`)}
                  aria-label="Ajuda"
                >
                  {/* Ponto de interrogação como texto, não ícone de linha
                      (pedido do usuário, 2026-09-01: "só tá aparecendo uma
                      bolinha... algo que entende que ali chama ajuda") — o
                      traço fino do ícone sumia nesse botão pequeno; texto
                      em negrito, igual o "Sair" ao lado, renderiza sempre
                      nítido. */}
                  <span aria-hidden="true">?</span>
                </button>
              )}
              <button className="app-logout-btn" onClick={handleLogout} aria-label="Sair">
                <span className="app-logout-label">Sair</span>
                <Icon name="logout" />
              </button>
            </div>
          )}
        </header>
      </div>

      <main className={links.length > 0 ? "app-main app-main-com-abas" : "app-main"}>{children}</main>

      {links.length > 0 && (
        <nav className="app-tabbar">
          {links.map((link) =>
            link.to === ROTA_VER_MAIS ? (
              <button
                key={link.to}
                type="button"
                className={menuAberto ? "app-tab active" : "app-tab"}
                onClick={() => setMenuAberto(true)}
              >
                <Icon name={link.icon} />
                <span>{link.tab}</span>
              </button>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) => (isActive ? "app-tab active" : "app-tab")}
              >
                <Icon name={link.icon} />
                <span>{link.tab}</span>
              </NavLink>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
