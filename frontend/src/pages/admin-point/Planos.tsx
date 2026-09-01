import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const criado = (location.state as { criado?: number } | null)?.criado;
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
      {criado && <p className="form-success">Plano de {criado}x por semana cadastrado.</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <p className="empty-state" style={{ paddingTop: 0 }}>
              Frequência semanal e preço — é o que o admin escolhe ao ativar uma assinatura de aluno.
            </p>
            {planos.length === 0 ? (
              <p className="empty-state">Nenhum plano cadastrado ainda.</p>
            ) : (
              <div className="card-list">
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
          </section>

          {new Set(planos.map((p) => p.frequencia_semanal)).size < 6 && (
            <section className="section">
              <Link to="/admin-point/configuracoes/planos/cadastrar" className="action-card">
                <span className="action-card-icon">
                  <Icon name="plus" />
                </span>
                <span className="action-card-info">
                  <span className="action-card-title">Cadastrar plano</span>
                  <span className="action-card-subtitle">Frequência semanal e preço mensal</span>
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
