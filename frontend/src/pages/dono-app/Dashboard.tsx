import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { PointRanking } from "../../api/types";
import { Layout } from "../../components/Layout";

export default function DonoAppDashboard() {
  const [ranking, setRanking] = useState<PointRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setRanking(await api.get<PointRanking[]>("/points/ranking"));
    } catch {
      setErro("Não foi possível carregar o ranking. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalTaxa = ranking.reduce((soma, p) => soma + p.total_taxa_servico, 0);
  const totalRepassado = ranking.reduce((soma, p) => soma + p.total_repassado, 0);
  const totalProfessores = ranking.reduce((soma, p) => soma + p.professores_ativos, 0);
  const totalAlunos = ranking.reduce((soma, p) => soma + p.alunos_ativos, 0);

  return (
    <Layout>
      <h1>Plataforma</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
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
                <div className="stat-label">Taxa de serviço arrecadada</div>
                <div className="stat-value">R$ {totalTaxa.toFixed(2)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Repassado a professores</div>
                <div className="stat-value">R$ {totalRepassado.toFixed(2)}</div>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Ranking por faturamento ({ranking.length})</h2>
            {ranking.length === 0 ? (
              <p className="empty-state">Nenhum Point cadastrado ainda.</p>
            ) : (
              <div className="card-list">
                {ranking.map((p, i) => (
                  <div className="item-card" key={p.point_id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        #{i + 1} · {p.nome}
                      </span>
                      <span className="item-card-subtitle">
                        {p.professores_ativos} professor(es) ativo(s) · {p.alunos_ativos} aluno(s)
                        ativo(s)
                      </span>
                    </div>
                    <div className="item-card-info" style={{ alignItems: "flex-end" }}>
                      <span className="item-card-title">R$ {p.total_taxa_servico.toFixed(2)}</span>
                      <span className="item-card-subtitle">
                        repassado R$ {p.total_repassado.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="empty-state">
            Check-ins por benefício e alertas de divergência entram quando a integração
            Wellhub/TotalPass (Fase 2, seção 5.4 do plano de arquitetura) estiver no ar.
          </p>
        </>
      )}
    </Layout>
  );
}
