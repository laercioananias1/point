import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, clearToken, getToken } from "../api/client";

export type Role = "super_admin" | "admin_point" | "professor" | "aluno";

export interface User {
  id: string;
  nome: string;
  role: Role;
  point_id: number | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** true só durante a rehidratação inicial da sessão (boot do app com um
   * token salvo) — telas que decidem rota a partir de `user.role` (Home)
   * devem esperar isso terminar antes de redirecionar, senão mandam de
   * volta pro login à toa enquanto /auth/me ainda não respondeu. */
  initializing: boolean;
  login: (identificador: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(getToken() !== null);

  // Recarregar a página mantém o token (localStorage), mas perde o `user`
  // em memória — busca de novo no boot do app pra não voltar pro login à toa.
  useEffect(() => {
    if (getToken()) {
      api
        .get<User>("/auth/me")
        .then(setUser)
        .catch(clearToken)
        .finally(() => setInitializing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identificador: string, senha: string) {
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string; user: User }>("/auth/login", {
        identificador,
        senha,
      });
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, logout }}>
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
