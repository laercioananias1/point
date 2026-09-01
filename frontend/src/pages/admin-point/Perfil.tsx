import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { ModeloRepasse } from "../../api/types";
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
 * caso comum de Point pequeno onde o dono também dá aula). Só o acordo de
 * repasse; nome/celular/e-mail vêm da própria conta. Some sozinho depois
 * (a seção só aparece pra quem ainda não tem o papel professor). */
function VirarProfessorSection({ onVirou }: { onVirou: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [modeloRepasse, setModeloRepasse] = useState<ModeloRepasse>("percentual");
  const [valorRepasse, setValorRepasse] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/vinculos/self", {
        modelo_repasse: modeloRepasse,
        valor_repasse: Number(valorRepasse),
      });
      await onVirou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível ativar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="section">
      <h2>Também dar aulas nesse Point</h2>
      {!aberto ? (
        <button type="button" className="secondary" onClick={() => setAberto(true)}>
          Virar professor deste Point
        </button>
      ) : (
        <form className="form-card" onSubmit={handleSubmit}>
          <p className="empty-state" style={{ padding: 0 }}>
            Ativa na hora, sem convite — usa seu próprio nome, celular e e-mail. É só o acordo de
            repasse que fica registrado, mesmo sendo você mesmo dando a aula.
          </p>
          <div className="form-row">
            <label>
              Modelo de repasse
              <select
                value={modeloRepasse}
                onChange={(e) => setModeloRepasse(e.target.value as ModeloRepasse)}
              >
                <option value="percentual">Percentual por aula/mensalidade</option>
                <option value="valor_fixo_mensal">Valor fixo mensal</option>
                <option value="valor_fixo_por_aula">Valor fixo por aula dada</option>
              </select>
            </label>
            <label>
              {modeloRepasse === "percentual" ? "Percentual (%)" : "Valor (R$)"}
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorRepasse}
                onChange={(e) => setValorRepasse(e.target.value)}
                required
              />
            </label>
          </div>

          {erro && <p className="form-error">{erro}</p>}

          <button type="submit" disabled={enviando}>
            {enviando ? "Ativando..." : "Virar professor"}
          </button>
        </form>
      )}
    </section>
  );
}
