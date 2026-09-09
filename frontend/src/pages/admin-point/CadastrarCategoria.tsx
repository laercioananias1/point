import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Icon, Layout } from "../../components/Layout";

const COR_PADRAO = "#3B82F6";

/** Tela própria pra cadastrar categoria (nível de aluno) — mesmo padrão
 * visual de CadastrarModalidade.tsx (pedido do usuário, 2026-09-08: "cada
 * point faz seu cadastro e define uma cor"). */
export default function AdminPointCadastrarCategoria() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(COR_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/categorias", { nome, cor });
      navigate("/admin-point/configuracoes/categorias", { state: { criada: nome } });
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
          onClick={() => navigate("/admin-point/configuracoes/categorias")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Cadastrar categoria</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
        <label>
          Nome da categoria
          <input
            placeholder="Iniciante, intermediário, avançado..."
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>

        <label>
          Cor de identificação
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              style={{ width: 44, height: 36, padding: 2, flexShrink: 0 }}
              aria-label="Cor da categoria"
            />
            <input
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              pattern="^#[0-9a-fA-F]{6}$"
              maxLength={7}
              required
            />
          </div>
        </label>
        <p className="empty-state" style={{ padding: 0 }}>
          Essa cor identifica as turmas dessa categoria na agenda.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Cadastrando..." : "Cadastrar categoria"}
        </button>
      </form>
    </Layout>
  );
}
