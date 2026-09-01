import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import { Icon } from "./Layout";

const ROTA_POR_PAPEL: Record<Role, string> = {
  super_admin: "/dono-app",
  admin_point: "/admin-point",
  professor: "/professor",
  aluno: "/aluno",
};

const ROTULO_POR_PAPEL: Record<Role, string> = {
  super_admin: "Dono do app",
  admin_point: "Admin do Point",
  professor: "Professor",
  aluno: "Aluno",
};

/** Botão pra trocar de área — só aparece se a conta tiver mais de um papel
 * (pedido do usuário, 2026-08-26: "o dono do Point é também o professor,
 * como fazemos isso?"). `papelAtual` fica de fora da lista, não faz
 * sentido "trocar" pra onde já está. */
export function TrocarArea({ papelAtual }: { papelAtual: Role }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const outrosPapeis = (user?.roles ?? []).filter((r) => r !== papelAtual);

  if (outrosPapeis.length === 0) {
    return null;
  }

  return (
    <section className="section">
      <h2>Trocar de área</h2>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Sua conta também tem acesso a outra área — troca sem precisar sair e entrar de novo.
      </p>
      <div className="card-list">
        {outrosPapeis.map((papel) => (
          <div
            key={papel}
            className="item-card item-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => navigate(ROTA_POR_PAPEL[papel])}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate(ROTA_POR_PAPEL[papel]);
            }}
          >
            <div className="item-card-info">
              <span className="item-card-title">{ROTULO_POR_PAPEL[papel]}</span>
            </div>
            <span aria-hidden="true">
              <Icon name="chevron-right" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
