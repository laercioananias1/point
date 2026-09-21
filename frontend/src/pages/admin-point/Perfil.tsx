import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Layout } from "../../components/Layout";
import { TemaToggle } from "../../components/TemaToggle";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do admin do Point (pedido do usuário, 2026-08-25: "seguindo o
 * mesmo padrão" — virou aba própria). Só dados de quem administra — o "Meu
 * Point" (nome/endereço/banners) saiu daqui (pedido do usuário, 2026-09-01:
 * "na tela do adm tb mostra o cabecalho q tem no professor e os dados do
 * point embaixo com as imagens") e foi pra Início, mesmo tratamento já
 * dado ao professor (pedido do usuário, 2026-08-30: "retira do perfil") —
 * não repete a mesma informação em duas telas. */
export default function AdminPointPerfil() {
  const { user, atualizarUser } = useAuth();

  return (
    <Layout>
      <h1>Perfil</h1>

      <section className="section">
        <h2>Minha conta</h2>
        <div className="item-card" style={{ alignItems: "flex-start" }}>
          <div className="item-card-info">
            <span className="item-card-title">{user?.nome}</span>
            <span className="item-card-subtitle">Admin do Point</span>
          </div>
        </div>
      </section>

      {!user?.roles.includes("professor") && <VirarProfessorSection onVirou={atualizarUser} />}

      <TemaToggle />

      <TrocarArea papelAtual="admin_point" />
    </Layout>
  );
}

/** Admin virar professor do próprio Point sem convite (pedido do usuário,
 * 2026-09-01: "isso mesmo, quero que aciona sem ter q enviar convite" —
 * caso comum de Point pequeno onde o dono também dá aula). Ativa na hora
 * com nome/celular/e-mail da própria conta (repasse saiu do sistema,
 * 2026-09-20, então não há mais nada a preencher). Some sozinho depois (a
 * seção só aparece pra quem ainda não tem o papel professor). */
function VirarProfessorSection({ onVirou }: { onVirou: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function virarProfessor() {
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/vinculos/self");
      await onVirou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível ativar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="section">
      <h2>Também dar aulas nesse Point</h2>
      <p className="empty-state" style={{ padding: 0 }}>
        Ativa na hora, sem convite — usa seu próprio nome, celular e e-mail.
      </p>
      {erro && <p className="form-error">{erro}</p>}
      <button type="button" className="secondary" disabled={enviando} onClick={virarProfessor}>
        {enviando ? "Ativando..." : "Virar professor deste Point"}
      </button>
    </section>
  );
}
