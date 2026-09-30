import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { PlataformaCheckin, WellhubCheckin } from "../../api/types";
import { inicioDaSemana, somarDias } from "../../components/Calendar";
import { Icon, Layout } from "../../components/Layout";
import { SaldoDoMes } from "../../components/SaldoDoMes";
import { rotuloPagamentoMeio } from "../../lib/formato";

type Periodo = "hoje" | "semana" | "mes";

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
];

function intervalo(periodo: Periodo, ref: Date): [Date, Date] {
  if (periodo === "hoje") return [ref, ref];
  if (periodo === "semana") {
    const inicio = inicioDaSemana(ref);
    return [inicio, somarDias(inicio, 6)];
  }
  return [new Date(ref.getFullYear(), ref.getMonth(), 1), new Date(ref.getFullYear(), ref.getMonth() + 1, 0)];
}

function navegar(periodo: Periodo, ref: Date, delta: number): Date {
  if (periodo === "hoje") return somarDias(ref, delta);
  if (periodo === "semana") return somarDias(ref, delta * 7);
  return new Date(ref.getFullYear(), ref.getMonth() + delta, 1);
}

function mesmoDia(a: Date, b: Date): boolean {
  return isoLocal(a) === isoLocal(b);
}

/** O backend grava created_at em UTC sem marcar o fuso — sem o "Z" o
 * navegador leria como hora local e mostraria 3h adiantado. */
function horaLocal(iso: string): string {
  const utc = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(utc).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "2026-09-05" — sem passar por UTC (toISOString mudaria o dia à noite). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-05" → "05/09". */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
}

/** Check-ins validados pela Wellhub/TotalPass nesse Point (automático
 * via webhook ou digitado na hora), com o saldo check-ins x aulas do mês
 * em cima (components/SaldoDoMes.tsx). Sem trava nenhuma — ver app/services/wellhub.py no
 * backend pro porquê de não amarrar check-in com aula. */
export default function AdminPointWellhub() {
  const navigate = useNavigate();

  // Filtro hoje/semana/mês (pedido do usuário, 2026-09-30).
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [referencia, setReferencia] = useState(() => new Date());
  const [checkins, setCheckins] = useState<WellhubCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  // Incrementa quando entra check-in novo, pro saldo do mês recarregar junto.
  const [versaoSaldo, setVersaoSaldo] = useState(0);

  const carregar = useCallback(async () => {
    setErro(null);
    const [inicio, fim] = intervalo(periodo, referencia);
    try {
      setCheckins(
        await api.get<WellhubCheckin[]>(`/wellhub/checkins?inicio=${isoLocal(inicio)}&fim=${isoLocal(fim)}`),
      );
    } catch {
      setErro("Não foi possível carregar os check-ins. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [periodo, referencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarPeriodo(novo: Periodo) {
    setLoading(true);
    setPeriodo(novo);
    setReferencia(new Date());
  }

  function mover(delta: number) {
    setLoading(true);
    setReferencia((atual) => navegar(periodo, atual, delta));
  }

  const hoje = new Date();
  const [inicioPeriodo, fimPeriodo] = intervalo(periodo, referencia);
  const noPeriodoAtual = isoLocal(hoje) >= isoLocal(inicioPeriodo) && isoLocal(hoje) <= isoLocal(fimPeriodo);
  const rotuloPeriodo =
    periodo === "hoje"
      ? mesmoDia(referencia, hoje)
        ? "Hoje"
        : referencia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
      : periodo === "semana"
        ? `${diaMes(isoLocal(inicioPeriodo))} – ${diaMes(isoLocal(fimPeriodo))}`
        : referencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const tituloLista =
    periodo === "hoje"
      ? mesmoDia(referencia, hoje)
        ? "Check-ins de hoje"
        : "Check-ins do dia"
      : periodo === "semana"
        ? noPeriodoAtual
          ? "Check-ins da semana"
          : "Check-ins da semana escolhida"
        : "Check-ins do mês";

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Checkins</h1>
      </div>

      <p className="cobranca-subtitulo">
        Check-ins validados pela Wellhub e pela TotalPass nesse Point. As plataformas não sabem em
        qual aula o aluno vai — só que o benefício está ativo no dia.
      </p>

      <div className="toggle-grid checkin-periodos" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            type="button"
            className={periodo === p.valor ? "toggle-chip active" : "toggle-chip"}
            onClick={() => mudarPeriodo(p.valor)}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="caixa-mes-nav">
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mover(-1)}
          aria-label="Período anterior"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <span className="caixa-mes-rotulo">{rotuloPeriodo}</span>
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mover(1)}
          aria-label="Próximo período"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      <SaldoDoMes
        mes={new Date(referencia.getFullYear(), referencia.getMonth(), 1)}
        versao={versaoSaldo}
        totalCheckinsPeriodo={checkins.length}
        onVinculado={carregar}
      />

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <section className="section">
            <h2>
              {tituloLista} ({checkins.length})
            </h2>
            {checkins.length === 0 ? (
              <p className="empty-state">Nenhum check-in nesse período.</p>
            ) : (
              <div className="card-list">
                {checkins.map((c) => (
                  <div className="item-card" key={c.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{c.aluno_nome ?? c.gympass_id}</span>
                      <span className="item-card-subtitle">
                        {diaMes(c.data)} às {horaLocal(c.created_at)} · {c.gympass_id}
                      </span>
                      {(c.email_wellhub || c.telefone_wellhub) && (
                        <span className="item-card-subtitle">
                          {[c.email_wellhub, c.telefone_wellhub].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <div className="checkin-pills">
                      <span className="status-pill status-neutral">{rotuloPagamentoMeio(c.plataforma)}</span>
                      <span className={`status-pill ${c.origem === "webhook" ? "status-good" : "status-info"}`}>
                        {c.origem === "webhook" ? "Automático" : "Manual"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <button type="button" className="fab" onClick={() => setFormularioAberto(true)}>
        <Icon name="plus" />
        Registrar check-in
      </button>

      {formularioAberto && (
        <CheckinManualModal
          onFechar={() => setFormularioAberto(false)}
          onSalvo={() => {
            setFormularioAberto(false);
            carregar();
            setVersaoSaldo((v) => v + 1);
          }}
        />
      )}
    </Layout>
  );
}

function CheckinManualModal({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [plataforma, setPlataforma] = useState<PlataformaCheckin>("wellhub");
  const [gympassId, setGympassId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/wellhub/checkins", { plataforma, gympass_id: gympassId.trim() });
      onSalvo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível validar esse check-in."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <form className="modal-card form-card" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="cobranca-modal-topo">
          <h2>Registrar check-in</h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <label>Plataforma</label>
        <div className="toggle-grid">
          {(["wellhub", "totalpass"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={plataforma === p ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setPlataforma(p)}
            >
              {rotuloPagamentoMeio(p)}
            </button>
          ))}
        </div>

        <label>
          {plataforma === "wellhub" ? "Gympass ID" : "Código do dia"}
          <input
            value={gympassId}
            onChange={(e) => setGympassId(e.target.value)}
            placeholder={plataforma === "wellhub" ? "13 dígitos, do app do aluno" : "código que aparece no app TotalPass"}
            maxLength={32}
            required
            autoFocus
          />
        </label>

        <p className="cobranca-dica">
          Use quando o aluno mostrar o código na recepção. Na Wellhub, o webhook automático já
          registra sozinho quando está cadastrado no portal deles.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Validando..." : "Validar check-in"}
        </button>
      </form>
    </div>
  );
}
