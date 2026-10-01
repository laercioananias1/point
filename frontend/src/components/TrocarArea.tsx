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
    <section className="alunos-card perfil-card">
      <h2 className="chk-secao-titulo">Trocar de área</h2>
      <p className="alunos-sub">Sua conta também tem acesso a outra área — troca sem sair e entrar de novo.</p>
      <div className="perfil-areas">
        {outrosPapeis.map((papel) => (
          <button key={papel} type="button" className="perfil-area" onClick={() => navigate(ROTA_POR_PAPEL[papel])}>
            {ROTULO_POR_PAPEL[papel]}
            <Icon name="chevron-right" size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}
