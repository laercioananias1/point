import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade, Quadra } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra quadras — saiu de dentro da antiga Configurações
 * (pedido do usuário, 2026-08-30: "Ver Mais" com um botão por seção). */
export default function AdminPointQuadras() {
  const navigate = useNavigate();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
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
      {criada && <p className="form-success">Quadra "{criada}" cadastrada.</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            {quadras.length === 0 ? (
              <p className="empty-state">Nenhuma quadra cadastrada ainda.</p>
            ) : (
              <div className="card-list">
                {quadras.map((q) => (
                  <QuadraRow key={q.id} quadra={q} modalidades={modalidades} onSalva={carregar} />
                ))}
              </div>
            )}
          </section>

          {modalidades.length === 0 ? (
            <section className="section">
              <p className="empty-state">
                Cadastre uma modalidade (Ver mais → Modalidades) antes de criar quadras.
              </p>
            </section>
          ) : (
            <section className="section">
              <Link to="/admin-point/configuracoes/quadras/cadastrar" className="action-card">
                <span className="action-card-icon">
                  <Icon name="plus" />
                </span>
                <span className="action-card-info">
                  <span className="action-card-title">Cadastrar quadra</span>
                  <span className="action-card-subtitle">Nome e modalidades atendidas</span>
                </span>
                <span className="action-card-chevron" aria-hidden="true">
                  <Icon name="chevron-right" />
                </span>
              </Link>
            </section>
          )}
        </>
      )}
    </Layout>
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
  const [nome, setNome] = useState(quadra.nome);
  const [modalidadeIds, setModalidadeIds] = useState(quadra.modalidades.map((m) => m.id));
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: number) {
    setModalidadeIds((atual) => (atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id]));
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/quadras/${quadra.id}`, { nome, modalidade_ids: modalidadeIds });
      setEditando(false);
      onSalva();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  // Validação de verdade fica no backend (checa turma/matrícula) — pedido
  // do usuário, 2026-09-01: "quadras e planos também da mesma forma"
  // [de modalidades: "validar para remover, verificar se já não existe
  // aplicada em alguma matrícula"].
  async function remover() {
    if (!confirm(`Remover a quadra "${quadra.nome}"?`)) return;
    setErro(null);
    setRemovendo(true);
    try {
      await api.delete(`/quadras/${quadra.id}`);
      onSalva();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível remover. Tente de novo.");
    } finally {
      setRemovendo(false);
    }
  }

  if (editando) {
    return (
      <div className="item-card" style={{ alignItems: "flex-start" }}>
        <div className="item-card-info" style={{ flex: 1 }}>
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
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
          {erro && <p className="form-error">{erro}</p>}
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
    <div className="item-card" style={{ alignItems: "flex-start" }}>
      <div className="item-card-info">
        <span className="item-card-title">{quadra.nome}</span>
        <span className="item-card-subtitle">
          {quadra.modalidades.map((m) => m.nome).join(", ") || "nenhuma modalidade associada"}
        </span>
        {erro && <p className="form-error">{erro}</p>}
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={() => setEditando(true)}>
          Editar
        </button>
        <button className="secondary" disabled={removendo} onClick={remover}>
          {removendo ? "Removendo..." : "Remover"}
        </button>
      </div>
    </div>
  );
}
