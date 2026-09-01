import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Plano } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

/** Tela própria pra planos mensais — saiu de dentro da antiga
 * Configurações (pedido do usuário, 2026-08-30: "Ver Mais" com um botão
 * por seção). */
export default function AdminPointPlanos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      setPlanos(await api.get<Plano[]>(`/planos?point_id=${user.point_id}`));
    } catch {
      setErro("Não foi possível carregar os planos. Tente novamente.");
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
        <h1>Planos mensais {!loading && `(${planos.length})`}</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <section className="section">
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
                    <span className="item-card-subtitle">{formatarReais(p.preco)} / mês</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <CriarPlanoForm existentes={planos.map((p) => p.frequencia_semanal)} onCriado={carregar} />
        </section>
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
