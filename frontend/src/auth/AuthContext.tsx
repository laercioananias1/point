import { createContext, useContext, useState, type ReactNode } from "react";
import { api, setToken, clearToken, getToken } from "../api/client";

export type Role = "super_admin" | "admin_point" | "professor" | "aluno";

export interface User {
  id: string;
  nome: string;
  role: Role;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identificador: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
