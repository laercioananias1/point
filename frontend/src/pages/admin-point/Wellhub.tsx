import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import type {
  PlataformaCheckin,
  WellhubCheckin,
  WellhubReconciliacao,
  WellhubReconciliacaoLinha,
} from "../../api/types";
import { inicioDaSemana, somarDias } from "../../components/Calendar";
import { Icon, Layout } from "../../components/Layout";
import { VincularAlunoModal, type PessoaSemVinculo } from "../../components/VincularAlunoModal";
import { rotuloPagamentoMeio } from "../../lib/formato";

/** Controle de check-ins (Wellhub/TotalPass) no layout do kit de design
 * (design/telas/Checkins.dc.html; pedido do usuário, 2026-10-01). O saldo
 * é mensal e só conta quantidade: check-ins - aulas confirmadas pelo
 * professor (a data do check-in não precisa bater com a da aula). Do
 * protótipo ficaram de fora "lembrar divergentes", "lembretes
 * automáticos" (ainda não existe envio de lembrete de check-in) e a
 * exportação da conciliação. */

type PeriodoLista = "hoje" | "semana" | "mes";
type Filtro = "Todos" | "Faltando" | "Em dia" | "Adiantados" | "Sem vínculo";

const FILTROS: Filtro[] = ["Todos", "Faltando", "Em dia", "Adiantados", "Sem vínculo"];
const PERIODOS: { valor: PeriodoLista; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
];
// Acima disso a barra de pílulas fica ilegível — mostra as primeiras.
const MAX_PILULAS = 24;

/** "2026-09-05" — sem passar por UTC (toISOString mudaria o dia à noite). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mesParam(d: Date): string {
  return isoLocal(d).slice(0, 7);
}

/** O backend grava created_at em UTC sem marcar o fuso — sem o "Z" o
 * navegador leria como hora local e mostraria 3h adiantado. */
function dataUtc(iso: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

function quandoFoi(iso: string): string {
  const d = dataUtc(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function situacao(l: WellhubReconciliacaoLinha): { rotulo: string; classe: string } {
  if (l.aluno_id === null) return { rotulo: "Sem vínculo", classe: "status-pill status-warn" };
  if (l.saldo < 0) return { rotulo: `${-l.saldo === 1 ? "Falta" : "Faltam"} ${-l.saldo}`, classe: "status-pill status-risk" };
  if (l.saldo === 0) return { rotulo: "Em dia", classe: "status-pill status-good" };
  return { rotulo: `+${l.saldo} ${l.saldo === 1 ? "adiantado" : "adiantados"}`, classe: "status-pill status-info" };
}

function passaNoFiltro(l: WellhubReconciliacaoLinha, f: Filtro): boolean {
  if (f === "Todos") return true;
  if (f === "Sem vínculo") return l.aluno_id === null;
  if (l.aluno_id === null) return false;
  if (f === "Faltando") return l.saldo < 0;
  if (f === "Em dia") return l.saldo === 0;
  return l.saldo > 0;
}

export default function AdminPointWellhub() {
  const hoje = new Date();
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [linhas, setLinhas] = useState<WellhubReconciliacaoLinha[]>([]);
  const [checkinsMes, setCheckinsMes] = useState<WellhubCheckin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [vinculando, setVinculando] = useState<PessoaSemVinculo | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [acerto, lista] = await Promise.all([
        api.get<WellhubReconciliacao>(`/wellhub/reconciliacao?mes=${mesParam(mes)}`),
        api.get<WellhubCheckin[]>(`/wellhub/checkins?mes=${mesParam(mes)}`),
      ]);
      setLinhas(acerto.linhas);
      setCheckinsMes(lista);
    } catch {
      setErro("Não foi possível carregar os check-ins. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const meses = [2, 1, 0].map((n) => new Date(hoje.getFullYear(), hoje.getMonth() - n, 1));
  const mesEmAndamento = mesParam(mes) === mesParam(hoje);
  const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long" });

  const vinculadas = linhas.filter((l) => l.aluno_id !== null);
  const faltando = vinculadas.filter((l) => l.saldo < 0);
  const checkinsFaltando = faltando.reduce((s, l) => s - l.saldo, 0);
  const checkinsSobrando = vinculadas.reduce((s, l) => s + Math.max(0, l.saldo), 0);
  const emDia = vinculadas.filter((l) => l.saldo === 0).length;
  const totalCheckins = linhas.reduce((s, l) => s + l.checkins_no_mes, 0);
  const visiveis = linhas.filter((l) => passaNoFiltro(l, filtro));

  // "Ultimo check-in automático" no lugar do "webhook online" do protótipo:
  // é o sinal de vida que dá pra ver sem acesso aos logs.
  const ultimoAutomatico = useMemo(
    () =>
      checkinsMes
        .filter((c) => c.origem === "webhook")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    [checkinsMes],
  );
  const automaticoRecente =
    ultimoAutomatico !== null && Date.now() - dataUtc(ultimoAutomatico.created_at).getTime() < 24 * 3600 * 1000;

  function ultimoCheckinDa(l: WellhubReconciliacaoLinha): WellhubCheckin | undefined {
    return checkinsMes.find((c) => c.plataforma === l.plataforma && c.gympass_id === l.gympass_id);
  }

  function nomeDaLinha(l: WellhubReconciliacaoLinha): string {
    return l.aluno_nome ?? ultimoCheckinDa(l)?.aluno_nome ?? l.gympass_id ?? "—";
  }

  function abrirVinculo(l: WellhubReconciliacaoLinha) {
    if (l.gympass_id === null) return;
    const ultimo = ultimoCheckinDa(l);
    setVinculando({
      plataforma: l.plataforma,
      gympass_id: l.gympass_id,
      nome: ultimo?.aluno_nome ?? null,
      email: ultimo?.email_wellhub ?? null,
    });
  }

  const tituloFechamento =
    faltando.length === 0
      ? vinculadas.length === 0
        ? "Nenhum aluno com benefício nesse mês"
        : emDia === vinculadas.length
          ? "Todos os alunos com o saldo em dia"
          : "Nenhum aluno com check-in faltando"
      : mesEmAndamento
        ? `${plural(faltando.length, "aluno está", "alunos estão")} com check-in faltando — ${plural(checkinsFaltando, "check-in", "check-ins")} até o fim do mês`
        : `${plural(faltando.length, "aluno fechou", "alunos fecharam")} ${nomeMes} com ${plural(checkinsFaltando, "check-in faltando", "check-ins faltando")}`;

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">Benefícios · Wellhub e TotalPass</div>
          <h1>Controle de check-ins</h1>
        </div>
        <div className="chk-topo-direita">
          <span className="chk-status" title="Último check-in que chegou sozinho pelo webhook">
            <span className={automaticoRecente ? "chk-status-ponto ativo" : "chk-status-ponto"} />
            {ultimoAutomatico
              ? `Último automático: ${quandoFoi(ultimoAutomatico.created_at)}`
              : "Nenhum check-in automático no mês"}
          </span>
          <div className="chk-meses" role="group" aria-label="Mês">
            {meses.map((m) => (
              <button
                key={mesParam(m)}
                type="button"
                className={mesParam(m) === mesParam(mes) ? "ativo" : ""}
                onClick={() => {
                  setCarregando(true);
                  setMes(m);
                }}
              >
                {m.toLocaleDateString("pt-BR", { month: "long" })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && <p className="form-error">{erro}</p>}

      <div className="chk-kpis">
        <div className="chk-kpi">
          <span className="chk-kpi-rotulo">Alunos no mês</span>
          <span className="chk-kpi-valor">{vinculadas.length}</span>
          <span className="chk-kpi-nota">com benefício e vínculo</span>
        </div>
        <div className="chk-kpi">
          <span className="chk-kpi-rotulo">Check-ins no mês</span>
          <span className="chk-kpi-valor">{totalCheckins}</span>
          <span className="chk-kpi-nota">Wellhub e TotalPass</span>
        </div>
        <div className="chk-kpi escuro">
          <span className="chk-kpi-rotulo">Check-ins faltando</span>
          <span className="chk-kpi-valor">{checkinsFaltando}</span>
          <span className="chk-kpi-nota">em {plural(faltando.length, "aluno", "alunos")}</span>
        </div>
        <div className="chk-kpi">
          <span className="chk-kpi-rotulo">Check-ins sobrando</span>
          <span className="chk-kpi-valor">{checkinsSobrando}</span>
          <span className="chk-kpi-nota">adiantados</span>
        </div>
        <div className="chk-kpi limao">
          <span className="chk-kpi-rotulo">Alunos em dia</span>
          <span className="chk-kpi-valor">{emDia}</span>
          <span className="chk-kpi-nota">saldo zerado</span>
        </div>
      </div>

      <div className="chk-fechamento">
        <div className="chk-fechamento-texto">
          <span className="chk-fechamento-tag">Fechamento de {nomeMes}</span>
          <span className="chk-fechamento-titulo">{tituloFechamento}</span>
          <span className="chk-fechamento-explica">
            Os check-ins não ficam presos a uma aula: o que vale é a quantidade. No fechamento, o total
            de check-ins de cada aluno precisa ser igual ao total de aulas confirmadas pelo professor.
          </span>
        </div>
      </div>

      <div className="chk-corpo">
        <section className="alunos-card chk-tabela-card">
          <div className="alunos-filtros">
            <h2 className="chk-secao-titulo">Check-ins por aluno</h2>
            <div className="toggle-grid" role="group" aria-label="Filtrar">
              {FILTROS.map((f) => {
                const n = linhas.filter((l) => passaNoFiltro(l, f)).length;
                return (
                  <button
                    key={f}
                    type="button"
                    className={filtro === f ? "toggle-chip active" : "toggle-chip"}
                    onClick={() => setFiltro(f)}
                  >
                    {f} <span className="chk-contagem">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {carregando && <p className="empty-state">Carregando...</p>}
          {!carregando && (
            <div className="alunos-tabela" role="table" aria-label="Check-ins por aluno">
              <div className="alunos-linha chk-grade alunos-cabecalho" role="row">
                <span role="columnheader">Aluno</span>
                <span role="columnheader">Benefício</span>
                <span role="columnheader">Aulas x check-ins</span>
                <span role="columnheader">Aulas</span>
                <span role="columnheader">Check-ins</span>
                <span role="columnheader">Saldo</span>
              </div>
              {visiveis.map((l) => (
                <LinhaAluno
                  key={`${l.plataforma}-${l.aluno_id ?? l.gympass_id}`}
                  linha={l}
                  nome={nomeDaLinha(l)}
                  onVincular={() => abrirVinculo(l)}
                />
              ))}
              {visiveis.length === 0 && (
                <p className="alunos-vazio">
                  {linhas.length === 0 ? `Nenhum check-in ou aula com benefício em ${nomeMes}.` : "Ninguém nesse filtro."}
                </p>
              )}
              <div className="chk-legenda">
                <span><i className="chk-pip coberta" /> Aula coberta por check-in</span>
                <span><i className="chk-pip descoberta" /> Aula sem check-in</span>
                <span><i className="chk-pip adiantado" /> Check-in adiantado</span>
              </div>
            </div>
          )}
        </section>

        <CheckinsRecebidos versao={versao} onRegistrar={() => setFormularioAberto(true)} />
      </div>

      {vinculando && (
        <VincularAlunoModal
          pessoa={vinculando}
          onFechar={() => setVinculando(null)}
          onSalvo={() => {
            setVinculando(null);
            setVersao((v) => v + 1);
          }}
        />
      )}

      {formularioAberto && (
        <CheckinManualModal
          onFechar={() => setFormularioAberto(false)}
          onSalvo={() => {
            setFormularioAberto(false);
            setVersao((v) => v + 1);
          }}
        />
      )}
    </Layout>
  );
}

function LinhaAluno({
  linha: l,
  nome,
  onVincular,
}: {
  linha: WellhubReconciliacaoLinha;
  nome: string;
  onVincular: () => void;
}) {
  const st = situacao(l);
  const cobertas = Math.min(l.aulas_no_mes, l.checkins_no_mes);
  const descobertas = Math.max(0, l.aulas_no_mes - l.checkins_no_mes);
  const adiantadas = l.aluno_id === null ? 0 : Math.max(0, l.checkins_no_mes - l.aulas_no_mes);
  const pilulas = [
    ...Array<string>(cobertas).fill("coberta"),
    ...Array<string>(descobertas).fill("descoberta"),
    ...Array<string>(adiantadas).fill("adiantado"),
  ];

  return (
    <div className="alunos-linha chk-grade" role="row">
      <div className="alunos-pessoa" role="cell">
        <div className="alunos-pessoa-texto">
          <span className="alunos-nome">{nome}</span>
          <span className="alunos-sub">{l.gympass_id ?? "sem identificador da plataforma"}</span>
        </div>
      </div>
      <span role="cell" data-rotulo="Benefício">
        <span className={`status-pill plano-${l.plataforma}`}>{rotuloPagamentoMeio(l.plataforma)}</span>
      </span>
      <span role="cell" data-rotulo="Aulas x check-ins" className="chk-pips-celula">
        {l.aluno_id === null ? (
          <span className="alunos-sub">Vincule o aluno pra comparar com as aulas.</span>
        ) : (
          <>
            <span className="chk-pips" aria-hidden="true">
              {pilulas.slice(0, MAX_PILULAS).map((tipo, i) => (
                <i key={i} className={`chk-pip ${tipo}`} />
              ))}
            </span>
            <span className="alunos-sub">
              {plural(l.aulas_no_mes, "aula", "aulas")}, {plural(l.checkins_no_mes, "check-in", "check-ins")}
            </span>
          </>
        )}
      </span>
      <span role="cell" data-rotulo="Aulas">
        <strong>{l.aluno_id === null ? "—" : l.aulas_no_mes}</strong>
      </span>
      <span role="cell" data-rotulo="Check-ins">
        <strong>{l.checkins_no_mes}</strong>
      </span>
      <span role="cell" data-rotulo="Saldo" className="alunos-celula-acoes">
        <span className={st.classe}>{st.rotulo}</span>
        {l.aluno_id === null && l.gympass_id !== null && (
          <button type="button" className="alunos-acao" onClick={onVincular}>
            Vincular aluno
          </button>
        )}
      </span>
    </div>
  );
}

function intervaloLista(periodo: PeriodoLista): [Date, Date] {
  const hoje = new Date();
  if (periodo === "hoje") return [hoje, hoje];
  if (periodo === "semana") {
    const inicio = inicioDaSemana(hoje);
    return [inicio, somarDias(inicio, 6)];
  }
  return [new Date(hoje.getFullYear(), hoje.getMonth(), 1), new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)];
}

/** Lista dos check-ins que chegaram, com o filtro hoje/semana/mês (pedido
 * do usuário, 2026-09-30) — no lugar dos "eventos do webhook" do kit. */
function CheckinsRecebidos({ versao, onRegistrar }: { versao: number; onRegistrar: () => void }) {
  const [periodo, setPeriodo] = useState<PeriodoLista>("hoje");
  const [itens, setItens] = useState<WellhubCheckin[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const [inicio, fim] = intervaloLista(periodo);
    setCarregando(true);
    api
      .get<WellhubCheckin[]>(`/wellhub/checkins?inicio=${isoLocal(inicio)}&fim=${isoLocal(fim)}`)
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setCarregando(false));
  }, [periodo, versao]);

  const ordenados = [...itens].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <aside className="alunos-card chk-recebidos">
      <div className="chk-recebidos-topo">
        <h2 className="chk-secao-titulo">
          Check-ins recebidos <span className="chk-contagem">{carregando ? "" : itens.length}</span>
        </h2>
        <div className="toggle-grid" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              className={periodo === p.valor ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando && <p className="empty-state">Carregando...</p>}
      {!carregando && ordenados.length === 0 && <p className="empty-state">Nenhum check-in nesse período.</p>}
      {!carregando &&
        ordenados.map((c) => (
          <div className="chk-evento" key={c.id}>
            <span className={c.origem === "webhook" ? "chk-evento-ponto auto" : "chk-evento-ponto"} />
            <div className="alunos-pessoa-texto chk-evento-texto">
              <span className="alunos-nome">{c.aluno_nome ?? c.gympass_id}</span>
              <span className="alunos-sub">
                {rotuloPagamentoMeio(c.plataforma)} · {c.origem === "webhook" ? "automático" : "manual"}
                {c.email_wellhub ? ` · ${c.email_wellhub}` : ""}
              </span>
            </div>
            <span className="alunos-sub chk-evento-hora">{quandoFoi(c.created_at)}</span>
          </div>
        ))}

      <button type="button" className="chk-registrar" onClick={onRegistrar}>
        <Icon name="plus" size={16} /> Registrar check-in
      </button>
    </aside>
  );
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
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
