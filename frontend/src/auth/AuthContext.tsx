import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  avisarSaidaOutrasAbas,
  clearToken,
  clearTokenSuporteOriginal,
  EVENTO_SESSAO_ENCERRADA,
  encerrarSuporte,
  getToken,
  getTokenSuporteOriginal,
  iniciarSuporte,
  pedirSessaoDeOutraAba,
  setToken,
} from "../api/client";

export type Role = "super_admin" | "admin_point" | "professor" | "aluno";

export interface User {
  id: string;
  nome: string;
  // Uma conta pode ter mais de um papel agora (pedido do usuário,
  // 2026-08-26 — dono do Point que também é professor). A barra de abas
  // não olha mais um "papel principal" fixo, e sim a rota atual (Layout.tsx);
  // `roles` só serve pra decidir a home inicial (App.tsx) e pra oferecer
  // "trocar de área" quando tem mais de um papel (telas de Perfil).
  roles: Role[];
  point_id: number | null;
  foto: string | null;
  email?: string | null;
  celular?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** true só durante a rehidratação inicial da sessão (boot do app com um
   * token salvo) — telas que decidem rota a partir de `user.roles` (Home)
   * devem esperar isso terminar antes de redirecionar, senão mandam de
   * volta pro login à toa enquanto /auth/me ainda não respondeu. */
  initializing: boolean;
  login: (email: string, senha: string, lembrar?: boolean) => Promise<void>;
  /** Loga direto com um token já emitido pelo backend — usado depois de
   * aceitar um convite como aluno novo (pedido do usuário, 2026-08-20), pra
   * não precisar de uma segunda ida à tela de login. */
  loginComToken: (token: string, user: User) => void;
  logout: () => void;
  /** true entre um "Entrar como suporte" e o "Voltar" — telas (Layout.tsx)
   * usam isso pra mostrar a faixa de aviso. */
  estaComoSuporte: boolean;
  /** Dono do app vira o admin de um Point pra dar suporte (pedido do
   * usuário, 2026-08-30) — troca de sessão igual loginComToken, mas
   * guarda o token de antes pra dar pra restaurar com sairDoSuporte. */
  entrarComoSuporte: (token: string, user: User) => void;
  /** Restaura a sessão de antes do "Entrar como suporte" — refaz /auth/me
   * com o token original em vez de guardar o `user` de antes em memória,
   * pra sempre voltar com dados frescos (papel pode ter mudado nesse
   * meio-tempo). Não faz nada se não estiver em modo suporte. */
  sairDoSuporte: () => Promise<void>;
  /** Rebusca /auth/me e atualiza o `user` em memória (pedido do usuário,
   * 2026-09-01: admin virando professor do próprio Point sem convite —
   * `roles` muda no backend na hora, mas o front só sabe se rebuscar). */
  atualizarUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  // Começa "inicializando" sempre: mesmo sem token nesta aba, outra aba
  // aberta pode ter a sessão (ver pedirSessaoDeOutraAba).
  const [initializing, setInitializing] = useState(true);
  const [estaComoSuporte, setEstaComoSuporte] = useState(getTokenSuporteOriginal() !== null);

  // Recarregar a página mantém o token (sessionStorage/localStorage), mas
  // perde o `user` em memória — busca de novo no boot.
  useEffect(() => {
    let ativo = true;
    pedirSessaoDeOutraAba().then((temSessao) => {
      if (!ativo) return;
      setEstaComoSuporte(getTokenSuporteOriginal() !== null);
      if (!temSessao && !getToken()) {
        setInitializing(false);
        return;
      }
      api
        .get<User>("/auth/me")
        .then((me) => ativo && setUser(me))
        .catch(clearToken)
        .finally(() => ativo && setInitializing(false));
    });
    return () => {
      ativo = false;
    };
  }, []);

  // "Sair" em outra aba (pedido do usuário, 2026-10-02): quem estava
  // logado aqui vai pro login também.
  useEffect(() => {
    function encerrada() {
      setUser((atual) => {
        if (atual) window.location.assign("/login");
        return null;
      });
      setEstaComoSuporte(false);
    }
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, encerrada);
    return () => window.removeEventListener(EVENTO_SESSAO_ENCERRADA, encerrada);
  }, []);

  async function login(email: string, senha: string, lembrar = false) {
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string; user: User }>("/auth/login", {
        email,
        senha,
      });
      // Login novo encerra qualquer suporte que tivesse ficado nesta aba.
      clearTokenSuporteOriginal();
      setEstaComoSuporte(false);
      setToken(res.access_token, lembrar);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }

  function loginComToken(token: string, novoUser: User) {
    setToken(token);
    setUser(novoUser);
  }

  function entrarComoSuporte(token: string, novoUser: User) {
    iniciarSuporte(token);
    setUser(novoUser);
    setEstaComoSuporte(true);
  }

  async function sairDoSuporte() {
    if (!encerrarSuporte()) return;
    setEstaComoSuporte(false);
    setLoading(true);
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarUser() {
    const me = await api.get<User>("/auth/me");
    setUser(me);
  }

  function logout() {
    clearToken();
    avisarSaidaOutrasAbas();
    // Sair de vez também encerra qualquer suporte em andamento (pedido do
    // usuário, 2026-08-30) — sem isso sobraria um token de suporte "órfão"
    // no localStorage, sem ninguém pra voltar pra ele.
    clearTokenSuporteOriginal();
    setEstaComoSuporte(false);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initializing,
        login,
        loginComToken,
        logout,
        estaComoSuporte,
        entrarComoSuporte,
        sairDoSuporte,
        atualizarUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
