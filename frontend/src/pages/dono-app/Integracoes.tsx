import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { IntegracaoLog, IntegracaoNome } from "../../api/types";
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
 * mensagem e o request/response completo só abrem num popup ao clicar. */
export default function DonoAppIntegracoes() {
  const navigate = useNavigate();
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

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/dono-app")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Logs de integrações</h1>
      </div>

      <p className="cobranca-subtitulo">
        WhatsApp, e-mail, Wellhub e TotalPass — cada chamada que falha ou dá certo fica registrada
        aqui, os 200 mais recentes por filtro. Clique numa linha pra ver os detalhes.
      </p>

      <div className="caixa-filtros">
        <div className="toggle-grid">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`toggle-chip${filtro === f.valor ? " active" : ""}`}
              onClick={() => setFiltro(f.valor)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`toggle-chip${somenteErros ? " active" : ""}`}
          onClick={() => setSomenteErros((atual) => !atual)}
        >
          Só erros
        </button>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          {!somenteErros && (
            <p className="cobranca-auto" style={{ marginBottom: 16 }}>
              <Icon name={totalErros > 0 ? "flag" : "check-circle"} size={15} />
              <span>
                {totalErros === 0
                  ? "Nenhum erro nessa lista."
                  : `${totalErros} com erro nessa lista.`}
              </span>
            </p>
          )}

          {logs.length === 0 ? (
            <p className="empty-state">Nenhum log com esses filtros.</p>
          ) : (
            <div className="log-tabela">
              <div className="log-linha log-linha-cabecalho">
                <span>Integração</span>
                <span className="log-col-point">Point</span>
                <span>Data</span>
                <span>Função</span>
                <span>Status</span>
              </div>
              {logs.map((log) => (
                <button
                  type="button"
                  className="log-linha"
                  key={log.id}
                  onClick={() => setLogAberto(log)}
                >
                  <span>{ROTULO_INTEGRACAO[log.integracao]}</span>
                  <span className="log-col-point">{log.point_nome ?? "—"}</span>
                  <span>{dataHora(log.criado_em)}</span>
                  <span>{log.evento}</span>
                  <span className={`status-pill ${log.sucesso ? "status-good" : "status-risk"}`}>
                    {log.sucesso ? "Sucesso" : "Erro"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

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
        <div className="cobranca-modal-topo">
          <h2>
            {ROTULO_INTEGRACAO[log.integracao]} · {log.evento}
          </h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="item-card-info">
          <span className="item-card-subtitle">
            {dataHora(log.criado_em)}
            {log.destino && ` · ${log.destino}`}
            {log.point_nome && ` · ${log.point_nome}`}
          </span>
          <span className={`status-pill ${log.sucesso ? "status-good" : "status-risk"}`} style={{ width: "fit-content" }}>
            {log.sucesso ? "Sucesso" : "Erro"}
          </span>
        </div>

        <p style={{ margin: 0 }}>{log.mensagem}</p>

        {log.request_corpo && (
          <div>
            <span className="item-card-subtitle" style={{ fontWeight: 700 }}>
              Requisição
            </span>
            <pre className="log-corpo">{log.request_corpo}</pre>
          </div>
        )}

        {log.response_corpo && (
          <div>
            <span className="item-card-subtitle" style={{ fontWeight: 700 }}>
              Resposta
            </span>
            <pre className="log-corpo">{log.response_corpo}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
