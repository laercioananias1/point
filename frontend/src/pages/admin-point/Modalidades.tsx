import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

/** Tela própria pra modalidades — saiu de dentro da antiga Configurações
 * (pedido do usuário, 2026-08-30: "Ver Mais" com um botão por seção). */
export default function AdminPointModalidades() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      setModalidades(await api.get<Modalidade[]>(`/modalidades?point_id=${user.point_id}`));
    } catch {
      setErro("Não foi possível carregar as modalidades. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/mais")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Modalidades {!loading && `(${modalidades.length})`}</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <section className="section">
          {modalidades.length === 0 ? (
            <p className="empty-state">Nenhuma modalidade cadastrada ainda.</p>
          ) : (
            <div className="card-list" style={{ marginBottom: "16px" }}>
              {modalidades.map((m) => (
                <ModalidadeRow key={m.id} modalidade={m} onSalva={carregar} />
              ))}
            </div>
          )}
          <CriarModalidadeForm onCriada={carregar} />
        </section>
      )}
    </Layout>
  );
}

function CriarModalidadeForm({ onCriada }: { onCriada: () => void }) {
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
      setNome("");
      setPrecoAvulso("");
      onCriada();
    } catch {
      setErro("Não foi possível cadastrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
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
        cadastrado em Planos (Configurações), não aqui.
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
  );
}

function ModalidadeRow({
  modalidade,
  onSalva,
}: {
  modalidade: Modalidade;
  onSalva: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [duracao, setDuracao] = useState(String(modalidade.duracao_padrao_minutos));
  const [precoAvulso, setPrecoAvulso] = useState(String(modalidade.preco_avulso));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await api.patch(`/modalidades/${modalidade.id}`, {
        duracao_padrao_minutos: Number(duracao),
        preco_avulso: Number(precoAvulso),
      });
      setEditando(false);
      onSalva();
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <div className="item-card" style={{ alignItems: "flex-start" }}>
        <div className="item-card-info" style={{ flex: 1 }}>
          <span className="item-card-title">{modalidade.nome}</span>
          <div className="form-row" style={{ marginTop: "6px" }}>
            <label>
              Duração (min)
              <input
                type="number"
                min="15"
                step="15"
                value={duracao}
                onChange={(e) => setDuracao(e.target.value)}
              />
            </label>
            <label>
              Avulsa (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={precoAvulso}
                onChange={(e) => setPrecoAvulso(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="item-card-actions">
          <button disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button className="secondary" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">{modalidade.nome}</span>
        <span className="item-card-subtitle">
          aula padrão de {modalidade.duracao_padrao_minutos} min · avulsa{" "}
          {formatarReais(modalidade.preco_avulso)}
        </span>
      </div>
      <button className="secondary" onClick={() => setEditando(true)}>
        Editar
      </button>
    </div>
  );
}
