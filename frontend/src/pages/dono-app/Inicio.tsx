import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { PointRanking } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

/** Home do dono do app (pedido do usuário, 2026-08-26: "seguindo o mesmo
 * padrão" das outras áreas — virou aba própria). Só o panorama; a lista de
 * Points, criar Point e convidar admin ficam na aba Points. */
export default function DonoAppInicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<PointRanking[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setRanking(await api.get<PointRanking[]>("/points/ranking"));
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os dados da plataforma. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalTaxa = ranking.reduce((soma, p) => soma + p.total_taxa_servico, 0);
  const totalRepassado = ranking.reduce((soma, p) => soma + p.total_repassado, 0);
  const totalPagoConfirmado = ranking.reduce((soma, p) => soma + p.total_pago_confirmado, 0);
  const totalProfessores = ranking.reduce((soma, p) => soma + p.professores_ativos, 0);
  const totalAlunos = ranking.reduce((soma, p) => soma + p.alunos_ativos, 0);

  const primeiroNome = user?.nome.split(" ")[0] ?? "";

  return (
    <Layout>
      <h1>Olá, {primeiroNome}!</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
            <h2>Visão geral</h2>
            <div className="stats-grid">
              <div className="stat-tile">
                <div className="stat-label">Points</div>
                <div className="stat-value">{ranking.length}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Professores ativos</div>
                <div className="stat-value">{totalProfessores}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Alunos ativos</div>
                <div className="stat-value">{totalAlunos}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Pago confirmado (todos os Points)</div>
                <div className="stat-value">{formatarReais(totalPagoConfirmado)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Taxa de serviço a receber</div>
                <div className="stat-value">{formatarReais(totalTaxa)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Repassado (fechamentos gerados)</div>
                <div className="stat-value">{formatarReais(totalRepassado)}</div>
              </div>
            </div>
            <p className="empty-state" style={{ paddingTop: 8 }}>
              "Pago confirmado" e "Taxa de serviço" são calculados na hora, direto dos pagamentos
              confirmados — não dependem de ninguém ter rodado um fechamento ainda. Só "Repassado"
              vem exclusivamente dos fechamentos já gerados (é dinheiro já reconciliado de verdade).
            </p>
          </section>

          {ranking.length > 0 && (
            <section className="section">
              <h2>Top 3 por taxa de serviço</h2>
              <div className="card-list">
                {ranking.slice(0, 3).map((p, i) => (
                  <div className="item-card" key={p.point_id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        #{i + 1} · {p.nome}
                      </span>
                      <span className="item-card-subtitle">
                        {p.professores_ativos} professor(es) · {p.alunos_ativos} aluno(s) ativo(s)
                      </span>
                    </div>
                    <span className="stat-value" style={{ fontSize: 20 }}>
                      {formatarReais(p.total_taxa_servico)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="link-btn"
                style={{ marginTop: 12 }}
                onClick={() => navigate("/dono-app/points")}
              >
                Ver todos os Points →
              </button>
            </section>
          )}
        </>
      )}
    </Layout>
  );
}
