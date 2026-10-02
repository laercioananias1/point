import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  // Espera o boot da sessão (pedido do usuário, 2026-10-02: sessão por
  // aba) — uma aba nova ainda pode receber a sessão de outra aba aberta.
  const { initializing } = useAuth();
  if (initializing) return null;
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
