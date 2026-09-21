import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { RelatorioResumo } from "../../api/types";
import { Icon, Layout, type IconName } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

/** "2026-09" → "Set". */
function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
  const limpo = texto.replace(".", "");
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const TONS = {
  accent: "rel-kpi-accent",
  info: "rel-kpi-info",
  good: "rel-kpi-good",
  warn: "rel-kpi-warn",
} as const;

function Kpi({
  rotulo,
  valor,
  detalhe,
  icone,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: IconName;
  tom: keyof typeof TONS;
}) {
  return (
    <div className={`rel-kpi ${TONS[tom]}`}>
      <div className="rel-kpi-topo">
        <span className="rel-kpi-rotulo">{rotulo}</span>
        <span className="rel-kpi-icone">
          <Icon name={icone} size={20} />
        </span>
      </div>
      <div className="rel-kpi-valor">{valor}</div>
      {detalhe && <div className="rel-kpi-detalhe">{detalhe}</div>}
    </div>
  );
}

/** Relatórios do Point (pedido do usuário, 2026-09-20: "faça um relatório,
 * tendo esse como ideia") — a saúde do negócio num relance: indicadores do
 * topo, receita x despesa dos últimos 6 meses (do Caixa) e o acumulado
 * financeiro. */
export default function AdminPointRelatorios() {
  const [dados, setDados] = useState<RelatorioResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RelatorioResumo>("/relatorios/resumo")
      .then(setDados)
      .catch(() => setErro("Não foi possível carregar os relatórios. Tente novamente."));
  }, []);

  const maiorValor = dados
    ? Math.max(0, ...dados.serie_mensal.flatMap((m) => [m.receita, m.despesa]))
    : 0;

  return (
    <Layout>
      <h1>Relatórios</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!dados && !erro && <p className="empty-state">Carregando...</p>}

      {dados && (
        <>
          <div className="rel-kpis">
            <Kpi rotulo="Alunos ativos" valor={String(dados.alunos_ativos)} icone="users" tom="accent" />
            <Kpi rotulo="Turmas" valor={String(dados.turmas)} icone="grid" tom="info" />
            <Kpi
              rotulo="Recebido no mês"
              valor={formatarReais(dados.recebido_mes)}
              icone="dollar"
              tom="good"
            />
            <Kpi
              rotulo="Inadimplência"
              valor={formatarPercentual(dados.inadimplencia_pct)}
              detalhe={`${dados.alunos_inadimplentes} de ${dados.alunos_ativos} alunos`}
              icone="flag"
              tom="warn"
            />
          </div>

          <section className="rel-card">
            <h2>Receita x Despesa — últimos 6 meses</h2>
            {maiorValor === 0 ? (
              <p className="empty-state">Sem movimentação no caixa nesses meses.</p>
            ) : (
              <div className="rel-grafico">
                {dados.serie_mensal.map((m) => (
                  <div className="rel-mes" key={m.mes}>
                    <div className="rel-barras">
                      <div
                        className="rel-barra rel-barra-receita"
                        style={{ height: `${Math.max((m.receita / maiorValor) * 100, m.receita > 0 ? 1.5 : 0)}%` }}
                        title={`Receita: ${formatarReais(m.receita)}`}
                      />
                      <div
                        className="rel-barra rel-barra-despesa"
                        style={{ height: `${Math.max((m.despesa / maiorValor) * 100, m.despesa > 0 ? 1.5 : 0)}%` }}
                        title={`Despesa: ${formatarReais(m.despesa)}`}
                      />
                    </div>
                    <span className="rel-mes-rotulo">{rotuloMes(m.mes)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rel-legenda">
              <span>
                <i className="rel-ponto rel-barra-receita" /> Receita
              </span>
              <span>
                <i className="rel-ponto rel-barra-despesa" /> Despesa
              </span>
            </div>
          </section>

          <section className="rel-card">
            <h2>Financeiro (acumulado)</h2>
            <div className="rel-fin-grade">
              <div>
                <div className="rel-fin-rotulo">↗ Entrou</div>
                <div className="rel-fin-valor rel-positivo">{formatarReais(dados.entrou)}</div>
              </div>
              <div>
                <div className="rel-fin-rotulo">↘ Saiu</div>
                <div className="rel-fin-valor rel-negativo">{formatarReais(dados.saiu)}</div>
              </div>
              <div>
                <div className="rel-fin-rotulo">A receber</div>
                <div className="rel-fin-valor rel-positivo">{formatarReais(dados.a_receber)}</div>
              </div>
              <div>
                <div className="rel-fin-rotulo">Atrasado</div>
                <div className="rel-fin-valor rel-negativo">{formatarReais(dados.atrasado)}</div>
              </div>
            </div>
            <div className="rel-fin-saldo">
              <div className="rel-fin-rotulo">Saldo (lucro)</div>
              <div
                className={`rel-fin-valor ${dados.saldo < 0 ? "rel-negativo" : "rel-positivo"}`}
              >
                {formatarReais(dados.saldo)}
              </div>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
