import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade, Quadra } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra quadras — saiu de dentro da antiga Configurações
 * (pedido do usuário, 2026-08-30: "Ver Mais" com um botão por seção). */
export default function AdminPointQuadras() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      const [quadrasRes, modalidadesRes] = await Promise.all([
        api.get<Quadra[]>(`/quadras?point_id=${user.point_id}`),
        api.get<Modalidade[]>(`/modalidades?point_id=${user.point_id}`),
      ]);
      setQuadras(quadrasRes);
      setModalidades(modalidadesRes);
    } catch {
      setErro("Não foi possível carregar as quadras. Tente novamente.");
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
        <h1>Quadras {!loading && `(${quadras.length})`}</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <section className="section">
          {quadras.length === 0 ? (
            <p className="empty-state">Nenhuma quadra cadastrada ainda.</p>
          ) : (
            <div className="card-list" style={{ marginBottom: "16px" }}>
              {quadras.map((q) => (
                <QuadraRow key={q.id} quadra={q} modalidades={modalidades} onSalva={carregar} />
              ))}
            </div>
          )}
          {modalidades.length === 0 ? (
            <p className="empty-state">Cadastre uma modalidade (Ver mais → Modalidades) antes de criar quadras.</p>
          ) : (
            <CriarQuadraForm modalidades={modalidades} onCriada={carregar} />
          )}
        </section>
      )}
    </Layout>
  );
}

function CriarQuadraForm({
  modalidades,
  onCriada,
}: {
  modalidades: Modalidade[];
  onCriada: () => void;
}) {
  const [nome, setNome] = useState("");
  const [modalidadeIds, setModalidadeIds] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: number) {
    setModalidadeIds((atual) => (atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (modalidadeIds.length === 0) {
      setErro("Marque pelo menos uma modalidade que essa quadra atende.");
      return;
    }
    setEnviando(true);
    try {
      await api.post("/quadras", { nome, modalidade_ids: modalidadeIds });
      setNome("");
      setModalidadeIds([]);
      onCriada();
    } catch {
      setErro("Não foi possível cadastrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <label>
        Nome da quadra
        <input value={nome} onChange={(e) => setNome(e.target.value)} required />
      </label>

      <label>
        Modalidades atendidas
        <div className="toggle-grid">
          {modalidades.map((m) => (
            <button
              key={m.id}
              type="button"
              className={modalidadeIds.includes(m.id) ? "toggle-chip active" : "toggle-chip"}
              onClick={() => alternar(m.id)}
            >
              {m.nome}
            </button>
          ))}
        </div>
      </label>

      {erro && <p className="form-error">{erro}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar quadra"}
      </button>
    </form>
  );
}

function QuadraRow({
  quadra,
  modalidades,
  onSalva,
}: {
  quadra: Quadra;
  modalidades: Modalidade[];
  onSalva: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [modalidadeIds, setModalidadeIds] = useState(quadra.modalidades.map((m) => m.id));
  const [salvando, setSalvando] = useState(false);

  function alternar(id: number) {
    setModalidadeIds((atual) => (atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id]));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.patch(`/quadras/${quadra.id}`, { modalidade_ids: modalidadeIds });
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
          <span className="item-card-title">{quadra.nome}</span>
          <div className="toggle-grid" style={{ marginTop: "6px" }}>
            {modalidades.map((m) => (
              <button
                key={m.id}
                type="button"
                className={modalidadeIds.includes(m.id) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => alternar(m.id)}
              >
                {m.nome}
              </button>
            ))}
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
        <span className="item-card-title">{quadra.nome}</span>
        <span className="item-card-subtitle">
          {quadra.modalidades.map((m) => m.nome).join(", ") || "nenhuma modalidade associada"}
        </span>
      </div>
      <button className="secondary" onClick={() => setEditando(true)}>
        Editar
      </button>
    </div>
  );
}
