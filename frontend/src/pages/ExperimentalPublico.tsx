import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { PointBrand } from "../components/PointBrand";
import { CategoriaBadge } from "../components/CategoriaBadge";
import { Icon } from "../components/Layout";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "../components/Calendar";
import { DIAS_SEMANA } from "../lib/dias";
import type { Categoria, PointResumo, Quadra, TurmaExperimentalAgenda } from "../api/types";
import { aplicarCorDestaque } from "../lib/cor";
import { formatarCelular } from "../lib/formato";

// Janela da página pública (pedido do usuário, 2026-09-14: "mostre
// somente 15 dias pra frente") — menor que o padrão do backend (21), que
// continua servindo outros usos da mesma agenda. A grade de semana
// (pedido do usuário, 2026-09-29: "faca o calendario de aula experimental
// nesse padrao", seguindo o mesmo layout por quadra/dia/hora da tela de
// Ocupação de quadra) navega só dentro dessa janela já carregada.
const DIAS_JANELA = 15;

// Abreviação sem ponto (pedido do usuário, 2026-09-14: "os dias da semana
// não precisa desse seg., ter. — tira esse pontinho") — o formatador do
// Intl em pt-BR sempre inclui o ponto ("seg."), por isso a lista própria
// em vez de toLocaleDateString com weekday: "short".
const DIAS_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDataCurta(iso: string): string {
  const data = new Date(iso + "T00:00");
  return `${DIAS_ABREV[data.getDay()]} ${String(data.getDate()).padStart(2, "0")}`;
}

function rotuloHorarioTurma(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

/** "#rrggbb" -> "r, g, b" (mesmo helper de GraficoOcupacao.tsx), pra pintar
 * a célula com a cor da categoria variando a opacidade em rgba(). */
function hexParaRgb(hex: string): string {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

type Selecionado = { turmaId: number; data: string; rotulo: string } | null;

/** Página pública (sem login) de aula experimental — pedido do usuário,
 * 2026-09-14: "criar uma pagina publica... poder solicitar uma aula
 * experimental. Ele conseguir ver agenda que tem aula esperimental livre
 * e fazer uma solicitacao". O professor divulga o link no WhatsApp/
 * Instagram; qualquer um abre, escolhe turma+data com vaga e manda os
 * próprios dados — vira uma SolicitacaoExperimental pendente, que o
 * professor/admin aprova depois (ver SolicitacoesExperimentais.tsx). */
export default function ExperimentalPublico() {
  // Token opaco, não o id do Point (pedido do usuário, 2026-09-14: "nao
  // identificar o id na url") — ver Point.link_experimental no backend.
  const { link } = useParams<{ link: string }>();
  const [point, setPoint] = useState<PointResumo | null>(null);
  const [turmas, setTurmas] = useState<TurmaExperimentalAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Selecionado>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!link) return;
    Promise.all([
      api.get<PointResumo>(`/experimental/${link}/point`),
      api.get<TurmaExperimentalAgenda[]>(`/experimental/${link}/agenda?dias=${DIAS_JANELA}`),
    ])
      .then(([p, t]) => {
        setPoint(p);
        setTurmas(t);
        aplicarCorDestaque(p.cor_destaque);
      })
      .catch(() => setErroCarregar("Não foi possível carregar essa página — confira o link."))
      .finally(() => setCarregando(false));
    return () => aplicarCorDestaque(null);
  }, [link]);

  function aoConfirmar() {
    setEnviado(true);
    setSelecionado(null);
    // Tira a data escolhida da lista sem precisar recarregar tudo — a
    // solicitação pendente já ocupa a vaga (ver vagas_ocupadas_em).
    setTurmas((atual) =>
      atual.map((t) =>
        t.id !== selecionado?.turmaId
          ? t
          : {
              ...t,
              proximas_datas: t.proximas_datas.map((d) =>
                d.data === selecionado.data ? { ...d, disponivel: false } : d,
              ),
            },
      ),
    );
  }

  return (
    <div className="auth-screen">
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
        <PointBrand point={point} />

        {carregando && <p className="auth-card">Carregando...</p>}
        {!carregando && erroCarregar && <p className="auth-card auth-error">{erroCarregar}</p>}

        {!carregando && !erroCarregar && point && (
          <>
            <div className="auth-card">
              <h1>{point.nome}</h1>
              <p className="auth-subtitle" style={{ marginBottom: 4 }}>
                {point.endereco}
              </p>
              <p style={{ fontSize: 14, margin: 0 }}>
                Escolha um horário abaixo e peça uma aula experimental — sem compromisso, sem
                cadastro. O professor confirma com você por WhatsApp ou e-mail.
              </p>
            </div>

            {enviado && (
              <p className="auth-card form-success">
                Pedido enviado! O professor ou o Point vai confirmar com você em breve.
              </p>
            )}

            {turmas.length === 0 ? (
              <p className="auth-card empty-state">
                Nenhum horário de aula experimental disponível agora — volte mais tarde.
              </p>
            ) : (
              <div className="auth-card">
                <AgendaExperimentalGrade
                  turmas={turmas}
                  selecionado={selecionado}
                  onSelecionar={(turmaId, data, rotulo) => setSelecionado({ turmaId, data, rotulo })}
                />
              </div>
            )}

            {selecionado && (
              <FormularioSolicitacao selecionado={selecionado} onConfirmar={aoConfirmar} onCancelar={() => setSelecionado(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Grade por quadra/dia/hora, mesmo padrão visual da tela "Ocupação de
 * quadra" (pedido do usuário, 2026-09-29: "faca o calendario de aula
 * experimental nesse padrao") — mas sem número real de ocupação: o
 * visitante sem login continua só vendo ✓ vaga / ✕ lotado (mesma regra já
 * usada no modo "disponibilidade" do GraficoOcupacao), só o layout muda de
 * lista de chips por turma pra grade única por quadra. Navega em semanas,
 * mas só dentro da janela de dias já carregada (DIAS_JANELA) — pedir uma
 * janela maior ao backend não faz sentido pra uma agenda pública. */
function AgendaExperimentalGrade({
  turmas,
  selecionado,
  onSelecionar,
}: {
  turmas: TurmaExperimentalAgenda[];
  selecionado: Selecionado;
  onSelecionar: (turmaId: number, data: string, rotulo: string) => void;
}) {
  const [referencia, setReferencia] = useState(new Date());
  const hoje = new Date();
  const inicioSemana = inicioDaSemana(referencia);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicioSemana, i));
  const hojeIso = toISODate(hoje);

  const inicioSemanaAtual = inicioDaSemana(hoje);
  const maxData = somarDias(hoje, DIAS_JANELA);
  const podeVoltar = inicioSemana > inicioSemanaAtual;
  const podeAvancar = somarDias(inicioSemana, 7) <= maxData;

  function tituloSemana(): string {
    const fim = diasDaSemana[6];
    const dia = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit" });
    const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" });
    return inicioSemana.getMonth() === fim.getMonth()
      ? `${dia(inicioSemana)}–${dia(fim)} de ${mes(fim)}`
      : `${dia(inicioSemana)} de ${mes(inicioSemana)} – ${dia(fim)} de ${mes(fim)}`;
  }

  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values());
  const categorias: Categoria[] = Array.from(
    new Map(turmas.map((t) => [t.categoria.id, t.categoria])).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="calendar-nav">
        <button className="secondary" type="button" disabled={!podeVoltar} onClick={() => setReferencia((r) => somarDias(r, -7))}>
          ‹
        </button>
        <button className="secondary" type="button" onClick={() => setReferencia(new Date())}>
          Hoje
        </button>
        <button className="secondary" type="button" disabled={!podeAvancar} onClick={() => setReferencia((r) => somarDias(r, 7))}>
          ›
        </button>
        <span className="calendar-title">{tituloSemana()}</span>
      </div>

      {categorias.length > 0 && (
        <div className="ocupacao-legenda-categorias">
          {categorias.map((c) => (
            <CategoriaBadge key={c.id} nome={c.nome} cor={c.cor} />
          ))}
        </div>
      )}

      {quadras.map((quadra: Quadra) => {
        const turmasDaQuadra = turmas.filter((t) => t.quadra.id === quadra.id);
        const horasEmUso = Array.from(
          new Set(turmasDaQuadra.map((t) => Number(t.horario.split(":")[0]))),
        ).sort((a, b) => a - b);

        const celulas = [
          <div className="ocupacao-cell ocupacao-corner" key="corner" />,
          ...diasDaSemana.map((data) => {
            const iso = toISODate(data);
            return (
              <div
                className={iso === hojeIso ? "ocupacao-cell ocupacao-header hoje" : "ocupacao-cell ocupacao-header"}
                key={`cabecalho-${iso}`}
              >
                {DIAS_SEMANA[(data.getDay() + 6) % 7].label} {data.getDate()}
              </div>
            );
          }),
          ...horasEmUso.flatMap((hora) => [
            <div className="ocupacao-cell ocupacao-hour-label" key={`hora-${hora}`}>
              {hora}h
            </div>,
            ...diasDaSemana.map((data) => {
              const iso = toISODate(data);
              const dia = diaSemanaDeData(data);
              const candidatas = turmasDaQuadra
                .filter((t) => Number(t.horario.split(":")[0]) === hora && t.dias_semana.includes(dia))
                .flatMap((t) => {
                  const disp = t.proximas_datas.find((d) => d.data === iso);
                  return disp ? [{ turma: t, disponivel: disp.disponivel }] : [];
                });

              if (candidatas.length === 0) {
                return <div className="ocupacao-cell ocupacao-slot ocupacao-slot-vazio" key={`${iso}-${hora}`} />;
              }

              const disponivel = candidatas.find((c) => c.disponivel);
              const escolha = disponivel ?? candidatas[0];
              const corBase = hexParaRgb(escolha.turma.categoria.cor);
              const lotado = !disponivel;
              const dataFormatada = new Date(iso + "T00:00").toLocaleDateString("pt-BR");
              const ativa = selecionado?.turmaId === escolha.turma.id && selecionado.data === iso;

              return (
                <div
                  className={
                    disponivel
                      ? "ocupacao-cell ocupacao-slot ocupacao-slot-ocupado ocupacao-slot-clicavel"
                      : "ocupacao-cell ocupacao-slot ocupacao-slot-ocupado"
                  }
                  key={`${iso}-${hora}`}
                  role={disponivel ? "button" : undefined}
                  tabIndex={disponivel ? 0 : undefined}
                  style={{
                    background: lotado ? "var(--risk-soft)" : `rgba(${corBase}, 0.35)`,
                    borderLeft: `3px solid ${lotado ? "var(--risk)" : `rgb(${corBase})`}`,
                    color: lotado ? "var(--risk)" : "var(--good)",
                    outline: ativa ? "2px solid var(--accent)" : undefined,
                  }}
                  title={`${quadra.nome} · ${dataFormatada} ${rotuloHorarioTurma(escolha.turma.horario)} — ${escolha.turma.modalidade.nome} (${escolha.turma.categoria.nome}) — ${lotado ? "sem vaga" : "vaga disponível"}`}
                  onClick={
                    disponivel
                      ? () =>
                          onSelecionar(
                            escolha.turma.id,
                            iso,
                            `${escolha.turma.modalidade.nome} · ${rotuloDataCurta(iso)} · ${escolha.turma.horario}`,
                          )
                      : undefined
                  }
                  onKeyDown={
                    disponivel
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onSelecionar(
                              escolha.turma.id,
                              iso,
                              `${escolha.turma.modalidade.nome} · ${rotuloDataCurta(iso)} · ${escolha.turma.horario}`,
                            );
                          }
                        }
                      : undefined
                  }
                >
                  <Icon name={lotado ? "x-circle" : "check-circle"} size={14} />
                </div>
              );
            }),
          ]),
        ];

        return (
          <div key={quadra.id}>
            <div className="ocupacao-quadra-header">
              <h3>{quadra.nome}</h3>
            </div>
            <div className="ocupacao-wrap">
              <div
                className="ocupacao-grid"
                style={{ gridTemplateColumns: `36px repeat(7, minmax(34px, 1fr))` }}
              >
                {celulas}
              </div>
            </div>
          </div>
        );
      })}

      <div className="ocupacao-legenda">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--good)" }}>
          <Icon name="check-circle" size={14} /> Tem vaga — clique pra pedir
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--risk)" }}>
          <Icon name="x-circle" size={14} /> Sem vaga
        </span>
      </div>
    </div>
  );
}

function FormularioSolicitacao({
  selecionado,
  onConfirmar,
  onCancelar,
}: {
  selecionado: { turmaId: number; data: string; rotulo: string };
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [temRaquete, setTemRaquete] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (temRaquete === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/experimental/solicitar", {
        turma_id: selecionado.turmaId,
        data: selecionado.data,
        nome,
        email,
        celular: celular.trim(),
        tem_raquete: temRaquete,
      });
      onConfirmar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h2 style={{ marginBottom: 4 }}>Pedir aula experimental</h2>
      <p className="auth-subtitle">{selecionado.rotulo}</p>

      <label htmlFor="nome">Nome</label>
      <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />

      <label htmlFor="email">E-mail</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label htmlFor="celular">Celular</label>
      <input
        id="celular"
        type="tel"
        placeholder="(11) 91234-5678"
        value={celular}
        onChange={(e) => setCelular(formatarCelular(e.target.value))}
        required
      />

      <label>Já tem raquete própria?</label>
      <div className="toggle-grid">
        <button
          type="button"
          className={temRaquete === true ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setTemRaquete(true)}
        >
          Sim
        </button>
        <button
          type="button"
          className={temRaquete === false ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setTemRaquete(false)}
        >
          Não
        </button>
      </div>

      {erro && <p className="auth-error">{erro}</p>}

      <button type="submit" disabled={enviando || temRaquete === null || !nome || !email || !celular}>
        {enviando ? "Enviando..." : "Pedir aula experimental"}
      </button>
      <button type="button" className="secondary" onClick={onCancelar} disabled={enviando}>
        Cancelar
      </button>
    </form>
  );
}
