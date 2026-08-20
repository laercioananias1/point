import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Dono do app",
  admin_point: "Admin do Point",
  professor: "Professor",
  aluno: "Aluno",
};

const NAV_LINKS: Record<string, { to: string; label: string }[]> = {
  admin_point: [
    { to: "/admin-point", label: "Aprovações" },
    { to: "/admin-point/faturamento", label: "Faturamento" },
    { to: "/admin-point/cadastro", label: "Cadastro" },
  ],
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? (NAV_LINKS[user.role] ?? []) : [];

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-brand">Point</span>
          {links.length > 0 && (
            <nav className="app-nav">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
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
