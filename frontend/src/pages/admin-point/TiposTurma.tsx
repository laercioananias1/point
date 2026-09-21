import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { TipoTurma } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";
import { BotaoFlutuante } from "../../components/BotaoFlutuante";

/** Tela própria pra tipos/formatos de turma — mesmo padrão de
 * Categorias.tsx (pedido do usuário, 2026-09-09: "Padrão", "Aula
 * individual", "Dupla", "Família"). */
export default function AdminPointTiposTurma() {
  const navigate = useNavigate();
  const location = useLocation();
  const criado = (location.state as { criado?: string } | null)?.criado;
  const { user } = useAuth();
  const [tipos, setTipos] = useState<TipoTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      setTipos(await api.get<TipoTurma[]>(`/tipos-turma?point_id=${user.point_id}`));
    } catch {
      setErro("Não foi possível carregar os tipos de turma. Tente novamente.");
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
          onClick={() => navigate("/admin-point")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Tipos de turma {!loading && `(${tipos.length})`}</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {criado && <p className="form-success">Tipo "{criado}" cadastrado.</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            {tipos.length === 0 ? (
              <p className="empty-state">Nenhum tipo de turma cadastrado ainda.</p>
            ) : (
              <div className="card-list">
                {tipos.map((t) => (
                  <TipoTurmaRow key={t.id} tipo={t} onSalvo={carregar} />
                ))}
              </div>
            )}
          </section>

          <BotaoFlutuante to="/admin-point/configuracoes/tipos-turma/cadastrar" rotulo="Novo tipo de turma" />
        </>
      )}
    </Layout>
  );
}

function TipoTurmaRow({ tipo, onSalvo }: { tipo: TipoTurma; onSalvo: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(tipo.nome);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, modal } = useConfirm();

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/tipos-turma/${tipo.id}`, { nome });
      setEditando(false);
      onSalvo();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!(await confirmar(`Remover o tipo "${tipo.nome}"?`))) return;
    setErro(null);
    setRemovendo(true);
    try {
      await api.delete(`/tipos-turma/${tipo.id}`);
      onSalvo();
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
    <div className="item-card">
      {modal}
      <div className="item-card-info">
        <span className="item-card-title">{tipo.nome}</span>
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
