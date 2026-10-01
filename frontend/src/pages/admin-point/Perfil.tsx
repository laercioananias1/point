import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { PerfilTopo } from "../../components/PerfilTopo";
import { TemaToggle } from "../../components/TemaToggle";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do admin do Point (pedido do usuário, 2026-08-25: "seguindo o
 * mesmo padrão" — virou aba própria). Só dados de quem administra — o "Meu
 * Point" (nome/endereço/banners) foi pra Início (pedido do usuário,
 * 2026-09-01), pra não repetir a mesma informação em duas telas. Layout do
 * kit (pedido do usuário, 2026-10-01): topo com foto + cards. */
export default function AdminPointPerfil() {
  const { user, atualizarUser } = useAuth();

  return (
    <Layout>
      <CabecalhoPagina titulo="Perfil" contexto="Minha conta" />
      <PerfilTopo papel="Admin do Point" />
      <div className="perfil-grade">
        {!user?.roles.includes("professor") && <VirarProfessorCard onVirou={atualizarUser} />}
        <TemaToggle />
        <TrocarArea papelAtual="admin_point" />
      </div>
    </Layout>
  );
}

/** Admin virar professor do próprio Point sem convite (pedido do usuário,
 * 2026-09-01: "isso mesmo, quero que aciona sem ter q enviar convite" —
 * caso comum de Point pequeno onde o dono também dá aula). Ativa na hora
 * com nome/celular/e-mail da própria conta. Some sozinho depois (o card só
 * aparece pra quem ainda não tem o papel professor). */
function VirarProfessorCard({ onVirou }: { onVirou: () => Promise<void> }) {
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
    <section className="alunos-card perfil-card">
      <h2 className="chk-secao-titulo">Também dar aulas nesse Point</h2>
      <p className="alunos-sub">
        Ativa na hora, sem convite — usa seu próprio nome, celular e e-mail. Depois é só criar suas turmas.
      </p>
      {erro && <p className="form-error">{erro}</p>}
      <button type="button" className="secondary perfil-card-botao" disabled={enviando} onClick={virarProfessor}>
        {enviando ? "Ativando..." : "Virar professor deste Point"}
      </button>
    </section>
  );
}
