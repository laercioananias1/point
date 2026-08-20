import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade, Plano, Quadra } from "../../api/types";
import { Layout } from "../../components/Layout";

export default function AdminPointCadastro() {
  const { user } = useAuth();

  if (!user?.point_id) {
    return (
      <Layout>
        <h1>Cadastro</h1>
        <p className="empty-state">Não foi possível identificar o seu Point.</p>
      </Layout>
    );
  }

  return <CadastroConteudo pointId={user.point_id} />;
}

function CadastroConteudo({ pointId }: { pointId: number }) {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [modalidadesRes, quadrasRes, planosRes] = await Promise.all([
        api.get<Modalidade[]>(`/modalidades?point_id=${pointId}`),
        api.get<Quadra[]>(`/quadras?point_id=${pointId}`),
        api.get<Plano[]>(`/planos?point_id=${pointId}`),
      ]);
      setModalidades(modalidadesRes);
      setQuadras(quadrasRes);
      setPlanos(planosRes);
    } catch {
      setErro("Não foi possível carregar o cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [pointId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <h1>Cadastro do Point</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <h2>Modalidades ({modalidades.length})</h2>
            {modalidades.length === 0 ? (
              <p className="empty-state">Nenhuma modalidade cadastrada ainda.</p>
            ) : (
              <div className="card-list" style={{ marginBottom: "16px" }}>
                {modalidades.map((m) => (
                  <div className="item-card" key={m.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{m.nome}</span>
                      <span className="item-card-subtitle">
                        aula padrão de {m.duracao_padrao_minutos} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CriarModalidadeForm onCriada={carregar} />
          </section>

          <section className="section">
            <h2>Quadras ({quadras.length})</h2>
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
              <p className="empty-state">Cadastre uma modalidade antes de criar quadras.</p>
            ) : (
              <CriarQuadraForm modalidades={modalidades} onCriada={carregar} />
            )}
          </section>

          <section className="section">
            <h2>Planos mensais ({planos.length})</h2>
            <p className="empty-state" style={{ paddingTop: 0 }}>
              Frequência semanal e preço — é o que o admin escolhe ao ativar uma assinatura de aluno.
            </p>
            {planos.length === 0 ? (
              <p className="empty-state">Nenhum plano cadastrado ainda.</p>
            ) : (
              <div className="card-list" style={{ marginBottom: "16px" }}>
                {planos.map((p) => (
                  <div className="item-card" key={p.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{p.frequencia_semanal}x por semana</span>
                      <span className="item-card-subtitle">R$ {p.preco.toFixed(2)} / mês</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CriarPlanoForm existentes={planos.map((p) => p.frequencia_semanal)} onCriado={carregar} />
          </section>
        </>
      )}
    </Layout>
  );
}

function CriarPlanoForm({
  existentes,
  onCriado,
}: {
  existentes: number[];
  onCriado: () => void;
}) {
  const frequenciasDisponiveis = [1, 2, 3, 4, 5, 6].filter((f) => !existentes.includes(f));
  const [frequencia, setFrequencia] = useState(frequenciasDisponiveis[0] ?? 1);
  const [preco, setPreco] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/planos", { frequencia_semanal: frequencia, preco: Number(preco) });
      setPreco("");
      onCriado();
    } catch {
      setErro("Não foi possível cadastrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (frequenciasDisponiveis.length === 0) {
    return <p className="empty-state">Já existe um plano pra cada frequência de 1 a 6x.</p>;
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Vezes por semana
          <select value={frequencia} onChange={(e) => setFrequencia(Number(e.target.value))}>
            {frequenciasDisponiveis.map((f) => (
              <option key={f} value={f}>
                {f}x
              </option>
            ))}
          </select>
        </label>
        <label>
          Preço mensal (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            required
          />
        </label>
      </div>
      {erro && <p className="form-error">{erro}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar plano"}
      </button>
    </form>
  );
}

function CriarModalidadeForm({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [duracao, setDuracao] = useState("60");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/modalidades", { nome, duracao_padrao_minutos: Number(duracao) });
      setNome("");
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
      {erro && <p className="form-error">{erro}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar modalidade"}
      </button>
    </form>
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
