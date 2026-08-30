const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Fotos de Point (pedido do usuário, 2026-08-30) vêm da API como caminho
// relativo (/uploads/...) — o back não sabe a própria URL pública, então
// quem monta a URL final é o front, igual já faz pra toda outra chamada.
export function urlArquivo(caminho: string): string {
  return `${API_URL}${caminho}`;
}

const TOKEN_KEY = "point_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Modo suporte (pedido do usuário, 2026-08-30: "pode fazer" — voltar pro
// dono do app depois de entrar como o admin de um Point) — guarda o token
// de ANTES de trocar de sessão, num slot separado, pra dar pra restaurar
// depois. Sobrevive a um F5 (localStorage, não estado em memória) — sem
// isso, recarregar a página no meio do suporte perderia o jeito de voltar.
const TOKEN_SUPORTE_ORIGINAL_KEY = "point_token_suporte_original";

export function getTokenSuporteOriginal(): string | null {
  return localStorage.getItem(TOKEN_SUPORTE_ORIGINAL_KEY);
}

export function setTokenSuporteOriginal(token: string): void {
  localStorage.setItem(TOKEN_SUPORTE_ORIGINAL_KEY, token);
}

export function clearTokenSuporteOriginal(): void {
  localStorage.removeItem(TOKEN_SUPORTE_ORIGINAL_KEY);
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
