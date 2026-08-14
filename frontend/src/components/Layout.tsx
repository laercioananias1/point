import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Dono do app",
  admin_point: "Admin do Point",
  professor: "Professor",
  aluno: "Aluno",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Point</span>
        {user && (
          <div className="app-user">
            <span className="app-user-role">{ROLE_LABEL[user.role] ?? user.role}</span>
            <span className="app-user-name">{user.nome}</span>
            <button onClick={handleLogout}>Sair</button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
