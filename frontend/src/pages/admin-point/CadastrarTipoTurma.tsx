import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra cadastrar tipo/formato de turma (pedido do usuário,
 * 2026-09-09) — mesmo padrão de CadastrarCategoria.tsx. Ex.: "Padrão",
 * "Aula individual", "Dupla", "Família". O flag de turma privada NÃO é
 * daqui — é escolhido na hora de criar a turma em si (Turma.privada é
 * independente do tipo). */
export default function AdminPointCadastrarTipoTurma() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/tipos-turma", { nome });
      navigate("/admin-point/configuracoes/tipos-turma", { state: { criado: nome } });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cadastrar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/configuracoes/tipos-turma")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Cadastrar tipo de turma</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
        <label>
          Nome do tipo
          <input
            placeholder="Aula individual, dupla, família..."
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <p className="empty-state" style={{ padding: 0 }}>
          Só uma etiqueta pra organizar as turmas. Se a turma vai ser privada (só professor/admin
          matricula) é escolhido na hora de criar a turma, não aqui.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Cadastrando..." : "Cadastrar tipo"}
        </button>
      </form>
    </Layout>
  );
}
