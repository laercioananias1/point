import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

/** Tela própria pra modalidades — saiu de dentro da antiga Configurações
 * (pedido do usuário, 2026-08-30: "Ver Mais" com um botão por seção). */
export default function AdminPointModalidades() {
  const navigate = useNavigate();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
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
      {criada && <p className="form-success">Modalidade "{criada}" cadastrada.</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            {modalidades.length === 0 ? (
              <p className="empty-state">Nenhuma modalidade cadastrada ainda.</p>
            ) : (
              <div className="card-list">
                {modalidades.map((m) => (
                  <ModalidadeRow key={m.id} modalidade={m} onSalva={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <Link to="/admin-point/configuracoes/modalidades/cadastrar" className="action-card">
              <span className="action-card-icon">
                <Icon name="plus" />
              </span>
              <span className="action-card-info">
                <span className="action-card-title">Cadastrar modalidade</span>
                <span className="action-card-subtitle">Nome, duração padrão da aula e preço da avulsa</span>
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

function ModalidadeRow({
  modalidade,
  onSalva,
}: {
  modalidade: Modalidade;
  onSalva: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(modalidade.nome);
  const [duracao, setDuracao] = useState(String(modalidade.duracao_padrao_minutos));
  const [precoAvulso, setPrecoAvulso] = useState(String(modalidade.preco_avulso));
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/modalidades/${modalidade.id}`, {
        nome,
        duracao_padrao_minutos: Number(duracao),
        preco_avulso: Number(precoAvulso),
      });
      setEditando(false);
      onSalva();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  // Validação de verdade fica no backend (checa turma/matrícula) — o
  // confirm() aqui é só o "tem certeza?" de sempre antes de remover
  // (pedido do usuário, 2026-09-01: "validar para remover, verificar se
  // já não existe já aplicada em alguma matrícula").
  async function remover() {
    if (!confirm(`Remover a modalidade "${modalidade.nome}"?`)) return;
    setErro(null);
    setRemovendo(true);
    try {
      await api.delete(`/modalidades/${modalidade.id}`);
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
        <span className="item-card-title">{modalidade.nome}</span>
        <span className="item-card-subtitle">
          aula padrão de {modalidade.duracao_padrao_minutos} min · avulsa{" "}
          {formatarReais(modalidade.preco_avulso)}
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
