const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Fotos de Point (pedido do usuário, 2026-08-30) vêm da API como caminho
// relativo (/uploads/...) — o back não sabe a própria URL pública, então
// quem monta a URL final é o front, igual já faz pra toda outra chamada.
export function urlArquivo(caminho: string): string {
  return `${API_URL}${caminho}`;
}

// Sessão (pedido do usuário, 2026-10-02: "quando fecha o navegador tem
// que ser automaticamente deslogado, por segurança") — o token fica no
// sessionStorage, que o navegador apaga ao fechar. Só quem marca "Manter
// conectado neste aparelho" no login guarda no localStorage (aluno no
// próprio celular, por exemplo). Abas novas pedem a sessão pras abas já
// abertas (BroadcastChannel), senão cada Ctrl+clique pediria login.
const TOKEN_KEY = "point_token";
const LEMBRAR_KEY = "point_lembrar";
// Modo suporte (pedido do usuário, 2026-08-30) — token de ANTES de trocar
// de sessão, pra dar pra voltar. Sempre só na aba: fechou o navegador, o
// suporte acaba.
const TOKEN_SUPORTE_ORIGINAL_KEY = "point_token_suporte_original";
const SUPORTE_LEMBRAR_KEY = "point_suporte_lembrar";

function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function lerSessao(chave: string): string | null {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function lembrando(): boolean {
  return lerLocal(LEMBRAR_KEY) === "1";
}

// Sessões de antes desta regra (token no localStorage sem ter escolhido
// "manter conectado") e suporte antigo persistido: saem na primeira carga.
try {
  if (!lembrando()) localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_SUPORTE_ORIGINAL_KEY);
} catch {
  /* armazenamento bloqueado — nada a limpar */
}

export function getToken(): string | null {
  return lerSessao(TOKEN_KEY) ?? (lembrando() ? lerLocal(TOKEN_KEY) : null);
}

/** `lembrar` só vem do login; nas outras trocas (convite, suporte) mantém
 * o modo atual. */
export function setToken(token: string, lembrar?: boolean): void {
  const manter = lembrar ?? lembrando();
  if (manter) {
    localStorage.setItem(LEMBRAR_KEY, "1");
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.removeItem(LEMBRAR_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEMBRAR_KEY);
}

export function getTokenSuporteOriginal(): string | null {
  return lerSessao(TOKEN_SUPORTE_ORIGINAL_KEY);
}

/** Entra no suporte: guarda a sessão atual e põe a do suporte só nesta aba
 * (não mexe no token "manter conectado", que volta sozinho ao fechar). */
export function iniciarSuporte(tokenSuporte: string): void {
  const atual = getToken();
  if (atual) {
    sessionStorage.setItem(TOKEN_SUPORTE_ORIGINAL_KEY, atual);
    sessionStorage.setItem(SUPORTE_LEMBRAR_KEY, lembrando() ? "1" : "0");
  }
  sessionStorage.setItem(TOKEN_KEY, tokenSuporte);
}

/** Sai do suporte devolvendo a sessão de antes. */
export function encerrarSuporte(): boolean {
  const original = getTokenSuporteOriginal();
  if (!original) return false;
  const lembrava = lerSessao(SUPORTE_LEMBRAR_KEY) === "1";
  sessionStorage.removeItem(TOKEN_SUPORTE_ORIGINAL_KEY);
  sessionStorage.removeItem(SUPORTE_LEMBRAR_KEY);
  if (lembrava) sessionStorage.removeItem(TOKEN_KEY);
  else sessionStorage.setItem(TOKEN_KEY, original);
  return true;
}

export function clearTokenSuporteOriginal(): void {
  sessionStorage.removeItem(TOKEN_SUPORTE_ORIGINAL_KEY);
  sessionStorage.removeItem(SUPORTE_LEMBRAR_KEY);
}

// --- Sessão compartilhada entre abas abertas ---------------------------
export const EVENTO_SESSAO_ENCERRADA = "opoint-sessao-encerrada";

type MensagemSessao =
  | { tipo: "pedir" }
  | { tipo: "sessao"; token: string; original: string | null; originalLembrar: string | null }
  | { tipo: "sair" };

const canal: BroadcastChannel | null = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("opoint-sessao") : null;

canal?.addEventListener("message", (e: MessageEvent<MensagemSessao>) => {
  const msg = e.data;
  if (msg.tipo === "pedir") {
    const token = lerSessao(TOKEN_KEY);
    if (token) {
      canal.postMessage({
        tipo: "sessao",
        token,
        original: lerSessao(TOKEN_SUPORTE_ORIGINAL_KEY),
        originalLembrar: lerSessao(SUPORTE_LEMBRAR_KEY),
      } satisfies MensagemSessao);
    }
  } else if (msg.tipo === "sair") {
    // O token "manter conectado" já foi apagado pela aba que saiu; aqui
    // limpa o desta aba e avisa o AuthContext, que manda pro login se
    // havia alguém logado nesta aba.
    clearToken();
    clearTokenSuporteOriginal();
    window.dispatchEvent(new Event(EVENTO_SESSAO_ENCERRADA));
  }
});

/** Aba nova sem sessão: pergunta às abas abertas (resposta em ~200 ms). */
export function pedirSessaoDeOutraAba(): Promise<boolean> {
  if (!canal || getToken()) return Promise.resolve(Boolean(getToken()));
  return new Promise((resolve) => {
    const tempo = window.setTimeout(() => {
      canal.removeEventListener("message", ouvir);
      resolve(false);
    }, 250);
    function ouvir(e: MessageEvent<MensagemSessao>) {
      if (e.data.tipo !== "sessao") return;
      window.clearTimeout(tempo);
      canal!.removeEventListener("message", ouvir);
      sessionStorage.setItem(TOKEN_KEY, e.data.token);
      if (e.data.original) {
        sessionStorage.setItem(TOKEN_SUPORTE_ORIGINAL_KEY, e.data.original);
        sessionStorage.setItem(SUPORTE_LEMBRAR_KEY, e.data.originalLembrar ?? "0");
      }
      resolve(true);
    }
    canal.addEventListener("message", ouvir);
    canal.postMessage({ tipo: "pedir" } satisfies MensagemSessao);
  });
}

/** Sair numa aba tira a sessão das outras também. */
export function avisarSaidaOutrasAbas(): void {
  canal?.postMessage({ tipo: "sair" } satisfies MensagemSessao);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? `Erro ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // Upload multipart (pedido do usuário, 2026-08-30: fotos de Point) — sem
  // Content-Type manual de propósito, o browser define o boundary sozinho
  // ao mandar FormData; `request` sempre forçava application/json, por
  // isso não dava pra reaproveitar ali.
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getToken();
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.detail ?? `Erro ${res.status}`);
    }
    return res.json() as Promise<T>;
  },
};
