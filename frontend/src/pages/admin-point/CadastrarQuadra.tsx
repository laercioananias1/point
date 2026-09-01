import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra cadastrar quadra (pedido do usuário, 2026-09-01:
 * "ajusta o cadastrar quadra no padrao igual modalidades") — mesmo
 * tratamento já aplicado em Criar Point/Cadastrar modalidade/Cadastrar
 * plano: o formulário que vivia embutido no fim da lista de Quadras.tsx
 * virou tela própria. */
export default function AdminPointCadastrarQuadra() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [modalidadeIds, setModalidadeIds] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErroCarregar(null);
    try {
      setModalidades(await api.get<Modalidade[]>(`/modalidades?point_id=${user.point_id}`));
    } catch {
      setErroCarregar("Não foi possível carregar as modalidades. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
      navigate("/admin-point/configuracoes/quadras", { state: { criada: nome } });
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
          onClick={() => navigate("/admin-point/configuracoes/quadras")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Cadastrar quadra</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erroCarregar && <p className="form-error">{erroCarregar}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erroCarregar && modalidades.length === 0 && (
        <p className="empty-state">Cadastre uma modalidade (Ver mais → Modalidades) antes de criar quadras.</p>
      )}

      {!loading && !erroCarregar && modalidades.length > 0 && (
        <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
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
      )}
    </Layout>
  );
}
