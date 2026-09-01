import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra cadastrar modalidade (pedido do usuário, 2026-09-01:
 * "deixa no padrao o cadastro, ter um botao para cadastrar e abre popup")
 * — mesmo padrão visual de ConvidarAluno.tsx/CriarPoint.tsx: antes o
 * formulário vivia embutido no fim da lista de Modalidades.tsx. */
export default function AdminPointCadastrarModalidade() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [duracao, setDuracao] = useState("60");
  const [precoAvulso, setPrecoAvulso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/modalidades", {
        nome,
        duracao_padrao_minutos: Number(duracao),
        preco_avulso: Number(precoAvulso),
      });
      navigate("/admin-point/configuracoes/modalidades", { state: { criada: nome } });
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
          onClick={() => navigate("/admin-point/configuracoes/modalidades")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Cadastrar modalidade</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
        <div className="form-row">
          <label>
            Nome da modalidade
            <input
              placeholder="Beach tennis, futevôlei..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </label>
          <label>
            Duração padrão da aula (min)
            <input
              type="number"
              min="15"
              step="15"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              required
            />
          </label>
        </div>
        <p className="empty-state" style={{ padding: 0 }}>
          Preço da aula avulsa dessa modalidade — vale pra qualquer professor que der aula dela aqui;
          com o professor você combina só o repasse. Preço do plano mensal é por frequência semanal,
          cadastrado em Planos (Ver mais), não aqui.
        </p>
        <label>
          Preço da aula avulsa (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={precoAvulso}
            onChange={(e) => setPrecoAvulso(e.target.value)}
            required
          />
        </label>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Cadastrando..." : "Cadastrar modalidade"}
        </button>
      </form>
    </Layout>
  );
}
