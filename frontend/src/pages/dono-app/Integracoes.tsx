import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { IntegracaoLog, IntegracaoNome } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";

type FiltroIntegracao = "todas" | IntegracaoNome;

const FILTROS: { valor: FiltroIntegracao; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "wellhub", rotulo: "Wellhub" },
  { valor: "totalpass", rotulo: "TotalPass" },
];

const ROTULO_INTEGRACAO: Record<IntegracaoNome, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  wellhub: "Wellhub",
  totalpass: "TotalPass",
};

/** O backend manda `criado_em` sem indicar timezone (é UTC "nu", sem
 * "Z") — sem isso o navegador interpreta como se já fosse hora local,
 * ficando 3h à frente no Brasil (pedido do usuário, 2026-09-29: "o
 * horário tá 3 horas pra frente"). Único lugar do app que mostra
 * hora:minuto de um datetime (o resto só mostra a data) — daí o bug só
 * ter aparecido aqui. */
function comoDataUtc(iso: string): Date {
  const temTimezone = iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(temTimezone ? iso : `${iso}Z`);
}

/** "2026-09-29T14:32:00" (UTC) → "29/09 11:32" (horário local do navegador). */
function dataHora(iso: string): string {
  const d = comoDataUtc(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Logs de integrações (pedido do usuário, 2026-09-29: "gostaria de ter
 * uma tela de logs de integrações, assim fico sabendo se tá dando erro ou
 * não") — WhatsApp, e-mail, Wellhub e TotalPass são todas fail-soft (nunca
 * derrubam quem chamou); antes só dava pra ver o resultado olhando o
 * console do servidor. Só o dono do app vê essa tela (pedido do usuário,
 * "essa tela só quem vê é o adm do sistema") — é diagnóstico da
 * plataforma inteira, não de um Point.
 *
 * Cada linha é só uma linha, em colunas (pedido do usuário, 2026-09-29:
 * "vai ter muitas requisições e isso vai tornar uma tela de rolagem muito
 * grande... deixe com colunas de integrador, data, função, status") — a
 * mensagem e o request/response completo só abrem num popup ao clicar.
 * Layout do kit (pedido do usuário, 2026-10-01): resumo por integração,
 * filtros em pílula e a tabela num card. */
export default function DonoAppIntegracoes() {
  const [logs, setLogs] = useState<IntegracaoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroIntegracao>("todas");
  const [somenteErros, setSomenteErros] = useState(false);
  const [logAberto, setLogAberto] = useState<IntegracaoLog | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const params = new URLSearchParams();
    if (filtro !== "todas") params.set("integracao", filtro);
    if (somenteErros) params.set("somente_erros", "true");
    try {
      const res = await api.get<IntegracaoLog[]>(`/integracoes/logs?${params}`);
      setLogs(res);
    } catch {
      setErro("Não foi possível carregar os logs. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [filtro, somenteErros]);

  useEffect(() => {
    setLoading(true);
    carregar();
  }, [carregar]);

  const totalErros = logs.filter((l) => !l.sucesso).length;
  // Resumo por integração da lista carregada (cada card também filtra).
  const resumo = FILTROS.filter((f) => f.valor !== "todas").map((f) => {
    const daIntegracao = logs.filter((l) => l.integracao === f.valor);
    return {
      valor: f.valor,
      rotulo: f.rotulo,
      total: daIntegracao.length,
      erros: daIntegracao.filter((l) => !l.sucesso).length,
    };
  });

  return (
    <Layout>
      <CabecalhoPagina titulo="Logs de integrações" contexto="Plataforma" />
      <p className="alunos-sub logs-intro">
        WhatsApp, e-mail, Wellhub e TotalPass — cada chamada que falha ou dá certo fica registrada aqui, as 200
        mais recentes por filtro. Clique numa linha pra ver a requisição e a resposta.
      </p>

      {filtro === "todas" && !loading && (
        <div className="logs-resumo">
          {resumo.map((r) => (
            <button key={r.valor} type="button" className="logs-resumo-card" onClick={() => setFiltro(r.valor)}>
              <span className={`plat-status ${r.erros > 0 ? "erro" : r.total > 0 ? "ok" : "parado"}`} aria-hidden="true" />
              <span className="logs-resumo-texto">
                <strong>{r.rotulo}</strong>
                <span className="alunos-sub">
                  {r.total === 0
                    ? "sem chamadas na lista"
                    : `${r.total} ${r.total === 1 ? "chamada" : "chamadas"}${r.erros > 0 ? ` · ${r.erros} ${r.erros === 1 ? "erro" : "erros"}` : ""}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="alunos-card logs-card">
        <div className="logs-filtros">
          <div className="agenda-passos" role="tablist" aria-label="Integração">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="tab"
                aria-selected={filtro === f.valor}
                className={filtro === f.valor ? "ativo" : ""}
                onClick={() => setFiltro(f.valor)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={somenteErros}
            className={somenteErros ? "logs-so-erros ativo" : "logs-so-erros"}
            onClick={() => setSomenteErros((atual) => !atual)}
          >
            <Icon name="flag" size={14} /> Só erros
          </button>
          {!loading && !somenteErros && (
            <span className={totalErros > 0 ? "logs-contagem erro" : "logs-contagem"}>
              {totalErros === 0 ? "Nenhum erro nessa lista" : `${totalErros} com erro nessa lista`}
            </span>
          )}
        </div>

        {erro && <p className="form-error">{erro}</p>}
        {loading && <p className="alunos-vazio">Carregando...</p>}

        {!loading &&
          (logs.length === 0 ? (
            <p className="alunos-vazio">Nenhum log com esses filtros.</p>
          ) : (
            <div className="alunos-tabela" role="table" aria-label="Logs de integrações">
              <div className="alunos-linha logs-grade alunos-cabecalho" role="row">
                <span role="columnheader">Integração</span>
                <span role="columnheader">Point</span>
                <span role="columnheader">Data</span>
                <span role="columnheader">Função</span>
                <span role="columnheader">Mensagem</span>
                <span role="columnheader">Status</span>
              </div>
              {logs.map((log) => (
                <button
                  type="button"
                  key={log.id}
                  role="row"
                  className={log.sucesso ? "alunos-linha logs-grade logs-linha" : "alunos-linha logs-grade logs-linha com-erro"}
                  onClick={() => setLogAberto(log)}
                >
                  <span role="cell" className="alunos-nome">
                    {ROTULO_INTEGRACAO[log.integracao]}
                  </span>
                  <span role="cell" data-rotulo="Point">
                    {log.point_nome ?? "—"}
                  </span>
                  <span role="cell" data-rotulo="Data">
                    {dataHora(log.criado_em)}
                  </span>
                  <span role="cell" data-rotulo="Função" className="logs-evento">
                    {log.evento}
                  </span>
                  <span role="cell" data-rotulo="Mensagem" className="alunos-sub logs-mensagem">
                    {log.mensagem}
                  </span>
                  <span role="cell" data-rotulo="Status">
                    <span className={`status-pill ${log.sucesso ? "status-good" : "status-risk"}`}>
                      {log.sucesso ? "Sucesso" : "Erro"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
      </section>

      {logAberto && <LogDetalheModal log={logAberto} onFechar={() => setLogAberto(null)} />}
    </Layout>
  );
}

function LogDetalheModal({ log, onFechar }: { log: IntegracaoLog; onFechar: () => void }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agenda-detalhe-topo">
          <span className={`status-pill ${log.sucesso ? "status-good" : "status-risk"}`}>
            {log.sucesso ? "Sucesso" : "Erro"}
          </span>
          <button type="button" className="agenda-detalhe-fechar" onClick={onFechar} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <h2 className="agenda-detalhe-titulo">
          {ROTULO_INTEGRACAO[log.integracao]} · {log.evento}
        </h2>

        <p className="alunos-sub logs-modal-meta">
          {dataHora(log.criado_em)}
          {log.destino && ` · ${log.destino}`}
          {log.point_nome && ` · ${log.point_nome}`}
        </p>

        <p className={log.sucesso ? "logs-modal-mensagem" : "logs-modal-mensagem erro"}>{log.mensagem}</p>

        {log.request_corpo && (
          <div>
            <span className="prof-aulas-titulo">Requisição</span>
            <pre className="log-corpo">{log.request_corpo}</pre>
          </div>
        )}

        {log.response_corpo && (
          <div>
            <span className="prof-aulas-titulo">Resposta</span>
            <pre className="log-corpo">{log.response_corpo}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
