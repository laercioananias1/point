import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Categoria } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra categorias (nível de aluno) — mesmo padrão de
 * Modalidades.tsx (pedido do usuário, 2026-09-08: "cada point faz seu
 * cadastro e define uma cor"). */
export default function AdminPointCategorias() {
  const navigate = useNavigate();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      setCategorias(await api.get<Categoria[]>(`/categorias?point_id=${user.point_id}`));
    } catch {
      setErro("Não foi possível carregar as categorias. Tente novamente.");
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
        <h1>Categorias {!loading && `(${categorias.length})`}</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {criada && <p className="form-success">Categoria "{criada}" cadastrada.</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            {categorias.length === 0 ? (
              <p className="empty-state">Nenhuma categoria cadastrada ainda.</p>
            ) : (
              <div className="card-list">
                {categorias.map((c) => (
                  <CategoriaRow key={c.id} categoria={c} onSalva={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <Link to="/admin-point/configuracoes/categorias/cadastrar" className="action-card">
              <span className="action-card-icon">
                <Icon name="plus" />
              </span>
              <span className="action-card-info">
                <span className="action-card-title">Cadastrar categoria</span>
                <span className="action-card-subtitle">
                  Nível do aluno (ex.: iniciante, intermediário, avançado) e a cor na agenda
                </span>
              </span>
              <span className="action-card-chevron" aria-hidden="true">
                <Icon name="chevron-right" />
              </span>
            </Link>
          </section>
        </>
      )}
    </Layout>
  );
}

function CategoriaRow({ categoria, onSalva }: { categoria: Categoria; onSalva: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [cor, setCor] = useState(categoria.cor);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, modal } = useConfirm();

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/categorias/${categoria.id}`, { nome, cor });
      setEditando(false);
      onSalva();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!(await confirmar(`Remover a categoria "${categoria.nome}"?`))) return;
    setErro(null);
    setRemovendo(true);
    try {
      await api.delete(`/categorias/${categoria.id}`);
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
          <label style={{ marginTop: "6px" }}>
            Cor
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
              />
            </div>
          </label>
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
      {modal}
      <div className="item-card-info">
        <span
          className="item-card-title"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span className="categoria-dot" style={{ background: categoria.cor }} aria-hidden="true" />
          {categoria.nome}
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
