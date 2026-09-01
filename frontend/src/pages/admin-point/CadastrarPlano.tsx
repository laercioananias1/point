import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Plano } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra cadastrar plano mensal (pedido do usuário, 2026-09-01:
 * "deixa tambem no padrao esse cadastro") — mesmo tratamento já aplicado
 * em Criar Point/Cadastrar modalidade: o formulário que vivia embutido no
 * fim da lista de Planos.tsx virou tela própria. Busca os planos já
 * cadastrados aqui de novo (a lista em Planos.tsx não persiste — telas
 * diferentes) só pra filtrar as frequências que já têm plano. */
export default function AdminPointCadastrarPlano() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [existentes, setExistentes] = useState<number[] | null>(null);
  const [frequencia, setFrequencia] = useState<number | null>(null);
  const [preco, setPreco] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    try {
      const planos = await api.get<Plano[]>(`/planos?point_id=${user.point_id}`);
      const freqs = planos.map((p) => p.frequencia_semanal);
      setExistentes(freqs);
      const disponiveis = [1, 2, 3, 4, 5, 6].filter((f) => !freqs.includes(f));
      setFrequencia(disponiveis[0] ?? null);
    } catch {
      setErro("Não foi possível carregar os planos já cadastrados. Tente novamente.");
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const frequenciasDisponiveis = [1, 2, 3, 4, 5, 6].filter((f) => !(existentes ?? []).includes(f));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (frequencia === null) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/planos", { frequencia_semanal: frequencia, preco: Number(preco) });
      navigate("/admin-point/configuracoes/planos", { state: { criado: frequencia } });
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
          onClick={() => navigate("/admin-point/configuracoes/planos")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Cadastrar plano</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {existentes === null && !erro && <p className="empty-state">Carregando...</p>}

      {existentes !== null && frequenciasDisponiveis.length === 0 && (
        <p className="empty-state">Já existe um plano pra cada frequência de 1 a 6x.</p>
      )}

      {existentes !== null && frequenciasDisponiveis.length > 0 && frequencia !== null && (
        <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
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

          <button type="submit" disabled={enviando}>
            {enviando ? "Cadastrando..." : "Cadastrar plano"}
          </button>
        </form>
      )}
    </Layout>
  );
}
