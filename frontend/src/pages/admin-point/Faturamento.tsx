import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Fechamento, Vinculo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais, rotuloRepasse } from "../../lib/formato";

/** Saiu da barra de abas do rodapé e virou botão dentro de Ver Mais
 * (pedido do usuário, 2026-08-30: "faturamento vai também pra dentro de
 * Ver mais") — mesmo tratamento já dado a Turmas/Ocupação/Aluno/
 * Professor antes: tela cheia com X pra fechar, aberta a partir de uma
 * caixinha, em vez de aba fixa. */
export default function AdminPointFaturamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      const [vinculosRes, fechamentosRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<Fechamento[]>(`/points/${user.point_id}/fechamentos`),
      ]);
      setVinculos(vinculosRes);
      setFechamentos(fechamentosRes);
    } catch {
      setErro("Não foi possível carregar o faturamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalTaxa = fechamentos.reduce((soma, f) => soma + f.total_taxa_servico, 0);
  const totalRepassado = fechamentos.reduce(
    (soma, f) => soma + f.repasses.reduce((s, r) => s + r.valor, 0),
    0,
  );

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/mais")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Faturamento</h1>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <div className="stats-grid">
              <div className="stat-tile">
                <div className="stat-label">Fechamentos gerados</div>
                <div className="stat-value">{fechamentos.length}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Taxa de serviço total</div>
                <div className="stat-value">{formatarReais(totalTaxa)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Repassado a professores</div>
                <div className="stat-value">{formatarReais(totalRepassado)}</div>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Repasse padrão por vínculo ({vinculos.length})</h2>
            {vinculos.length === 0 ? (
              <p className="empty-state">Nenhum vínculo ainda.</p>
            ) : (
              <div className="card-list">
                {vinculos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.professor.nome}</span>
                      <span className="item-card-subtitle">
                        {rotuloRepasse(v.modelo_repasse, v.valor_repasse)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* "Exceções de repasse por aluno" (com o form "Definir nova
              exceção") saiu daqui (pedido do usuário, 2026-08-30: "tira
              essa exceção porque precisa ser melhor definida") — volta
              redesenhada mais pra frente. O endpoint (PATCH
              /matriculas/{id}/repasse) continua no backend. */}

          {/* "Gerar fechamento" saiu daqui por enquanto (pedido do usuário,
              2026-08-30) — o texto dizia "roda sozinho no 5º dia útil", mas
              isso nunca chegou a existir de verdade (só documentado como
              intenção futura); com a confirmação de pagamento Pix pausada
              até a API de verdade chegar, esse disparo manual também some
              até lá. O endpoint (POST /points/{id}/fechamentos) continua
              no backend. */}

          <section className="section">
            <h2>Histórico de fechamentos ({fechamentos.length})</h2>
            {fechamentos.length === 0 ? (
              <p className="empty-state">Nenhum fechamento gerado ainda.</p>
            ) : (
              <div className="card-list">
                {fechamentos.map((f) => (
                  <div className="item-card" key={f.id} style={{ alignItems: "flex-start" }}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {f.periodo_inicio} a {f.periodo_fim}
                      </span>
                      <span className="item-card-subtitle">
                        {f.quantidade_pagamentos} pagamento(s) · taxa total{" "}
                        {formatarReais(f.total_taxa_servico)}
                      </span>
                      {f.repasses.map((r) => (
                        <span className="item-card-subtitle" key={r.professor_id}>
                          {r.professor_nome}: {formatarReais(r.valor)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}


