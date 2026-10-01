import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type {
  Convite,
  Matricula,
  Point,
  SolicitacaoExperimental,
  TurmaResumo,
  Vinculo,
  WellhubCheckin,
  WellhubReconciliacao,
} from "../../api/types";
import { Carrossel } from "../../components/Carrossel";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { diaSemanaDeData, toISODate } from "../../components/Calendar";
import { Icon, Layout, type IconName } from "../../components/Layout";

/** Início do admin do Point no layout do kit de design
 * (design/telas/Dashboard.dc.html; pedido do usuário, 2026-10-01) — "o
 * que eu preciso fazer hoje": pendências que pedem ação, aulas de hoje com
 * ocupação, pedidos de aula experimental pra responder ali mesmo, e os
 * números do dia. Os dados do Point (banners, fotos, sobre) continuam no
 * fim (pedido do usuário, 2026-09-01). */

function horaCurta(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function turmaAconteceEm(t: TurmaResumo, iso: string, dia: string): boolean {
  const noPeriodo = iso >= t.periodo_inicio && (t.periodo_fim === null || iso <= t.periodo_fim);
  return noPeriodo && t.dias_semana.includes(dia) && !t.excecoes.includes(iso);
}

/** Mesma conta da Ocupação de quadra (GraficoOcupacao): mensal conta nos
 * dias dela a partir do início; avulsa só na data escolhida. */
function alunosNaData(turmaId: number, matriculas: Matricula[], iso: string, dia: string): number {
  return matriculas.filter((m) => {
    if (m.turma_id !== turmaId || m.status !== "ativa") return false;
    if (m.tipo === "mensal") {
      return m.dias_semana.includes(dia) && iso >= m.data_inicio_efetiva && !m.excecoes.includes(iso);
    }
    return m.data_inicio_efetiva === iso;
  }).length;
}

function classeBarra(pct: number): string {
  if (pct >= 100) return "turmas-barra cheia";
  if (pct >= 75) return "turmas-barra alta";
  return "turmas-barra";
}

type Pendencia = { chave: string; texto: string; para: string; icone: IconName };

export default function AdminPointInicio() {
  const { user } = useAuth();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [point, setPoint] = useState<Point | null>(null);
  const [experimentais, setExperimentais] = useState<SolicitacaoExperimental[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [acerto, setAcerto] = useState<WellhubReconciliacao | null>(null);
  const [checkinsHoje, setCheckinsHoje] = useState<WellhubCheckin[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalidade, setModalidade] = useState<string>("todas");

  const hoje = new Date();
  const hojeIso = toISODate(hoje);
  const diaHoje = diaSemanaDeData(hoje);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [mat, vin, tur, pt, exp, conv, rec, chk] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Vinculo[]>("/vinculos"),
        user?.point_id ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`) : Promise.resolve([]),
        api.get<Point>("/points/me"),
        api.get<SolicitacaoExperimental[]>("/experimental/solicitacoes?status=pendente"),
        api.get<Convite[]>("/convites"),
        api.get<WellhubReconciliacao>(`/wellhub/reconciliacao?mes=${hojeIso.slice(0, 7)}`),
        api.get<WellhubCheckin[]>(`/wellhub/checkins?inicio=${hojeIso}&fim=${hojeIso}`),
      ]);
      setMatriculas(mat);
      setVinculos(vin);
      setTurmas(tur);
      setPoint(pt);
      setExperimentais(exp);
      setConvites(conv);
      setAcerto(rec);
      setCheckinsHoje(chk);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os dados do Point. Tente novamente.");
    }
  }, [user?.point_id, hojeIso]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alunosAtivos = new Set(matriculas.filter((m) => m.status === "ativa").map((m) => m.aluno.id)).size;
  const professoresAtivos = vinculos.filter((v) => v.status === "ativo").length;
  const vencidas = matriculas.filter((m) => m.tipo === "mensal" && m.status === "ativa" && m.inadimplente);
  const convitesExpirados = convites.filter((c) => c.status === "pendente" && c.expirado);
  const comFalta = (acerto?.linhas ?? []).filter((l) => l.aluno_id !== null && l.saldo < 0);

  const aulasHoje = useMemo(
    () =>
      turmas
        .filter((t) => turmaAconteceEm(t, hojeIso, diaHoje))
        .map((t) => ({ turma: t, alunos: alunosNaData(t.id, matriculas, hojeIso, diaHoje) }))
        .sort((a, b) => a.turma.horario.localeCompare(b.turma.horario)),
    [turmas, matriculas, hojeIso, diaHoje],
  );
  const vagasHoje = aulasHoje.reduce((s, a) => s + a.turma.capacidade, 0);
  const alunosHoje = aulasHoje.reduce((s, a) => s + a.alunos, 0);
  const quadrasHoje = new Set(aulasHoje.map((a) => a.turma.quadra.id)).size;
  const modalidadesHoje = Array.from(new Set(aulasHoje.map((a) => a.turma.modalidade.nome))).sort();
  const aulasVisiveis =
    modalidade === "todas" ? aulasHoje : aulasHoje.filter((a) => a.turma.modalidade.nome === modalidade);

  // Ocupação "fixa" por horário: alunos mensais ativos / vagas das turmas
  // de cada hora (o protótipo usa média de 4 semanas; aqui é o retrato de
  // agora, que é o que dá pra calcular sem histórico).
  const porHora = useMemo(() => {
    const mapa = new Map<number, { alunos: number; vagas: number }>();
    for (const t of turmas) {
      if (t.periodo_fim !== null && t.periodo_fim < hojeIso) continue;
      const hora = Number(t.horario.slice(0, 2));
      const atual = mapa.get(hora) ?? { alunos: 0, vagas: 0 };
      atual.vagas += t.capacidade;
      atual.alunos += matriculas.filter((m) => m.turma_id === t.id && m.status === "ativa" && m.tipo === "mensal").length;
      mapa.set(hora, atual);
    }
    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hora, v]) => ({ hora, pct: v.vagas > 0 ? Math.round((v.alunos / v.vagas) * 100) : 0 }));
  }, [turmas, matriculas, hojeIso]);

  const pendencias: Pendencia[] = [
    experimentais.length > 0 && {
      chave: "exp",
      texto: plural(experimentais.length, "pedido de aula experimental", "pedidos de aula experimental"),
      para: "/admin-point/experimental",
      icone: "user-plus",
    },
    vencidas.length > 0 && {
      chave: "venc",
      texto: plural(vencidas.length, "mensalidade vencida", "mensalidades vencidas"),
      para: "/admin-point/cobrancas",
      icone: "dollar",
    },
    comFalta.length > 0 && {
      chave: "chk",
      texto: `${plural(comFalta.length, "aluno", "alunos")} com check-in faltando`,
      para: "/admin-point/wellhub",
      icone: "check-circle",
    },
    convitesExpirados.length > 0 && {
      chave: "conv",
      texto: plural(convitesExpirados.length, "convite expirado", "convites expirados"),
      para: "/admin-point/aluno",
      icone: "mail",
    },
  ].filter(Boolean) as Pendencia[];

  const dataLonga = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dataHoje = dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1);

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">{dataHoje}</div>
          <h1>
            {saudacao()}, {point?.nome ?? user?.nome.split(" ")[0] ?? ""}
          </h1>
          {pronto && (
            <div className="pagina-contexto">
              {plural(alunosAtivos, "aluno ativo", "alunos ativos")} · {plural(professoresAtivos, "professor", "professores")} ·{" "}
              {plural(turmas.length, "turma", "turmas")}
            </div>
          )}
        </div>
        <div className="inicio-acoes">
          <Link to="/admin-point/agenda" className="botao-link botao-link-secundario">
            Ver agenda
          </Link>
          <Link to="/admin-point/turmas/cadastrar" className="botao-link">
            + Nova turma
          </Link>
        </div>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <div className="inicio-pendencias">
            {pendencias.length === 0 ? (
              <span className="inicio-pendencia ok">
                <Icon name="check-circle" size={16} /> Nada pendente por agora
              </span>
            ) : (
              pendencias.map((p) => (
                <Link key={p.chave} to={p.para} className="inicio-pendencia">
                  <Icon name={p.icone} size={16} /> {p.texto}
                  <Icon name="chevron-right" size={14} />
                </Link>
              ))
            )}
          </div>

          <div className="chk-kpis">
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Aulas hoje</span>
              <span className="chk-kpi-valor">{aulasHoje.length}</span>
              <span className="chk-kpi-nota">{plural(quadrasHoje, "quadra em uso", "quadras em uso")}</span>
            </div>
            <div className="chk-kpi escuro">
              <span className="chk-kpi-rotulo">Ocupação de hoje</span>
              <span className="chk-kpi-valor">{vagasHoje > 0 ? `${Math.round((alunosHoje / vagasHoje) * 100)}%` : "—"}</span>
              <span className="chk-kpi-nota">
                {alunosHoje} de {plural(vagasHoje, "vaga", "vagas")}
              </span>
            </div>
            <div className="chk-kpi limao">
              <span className="chk-kpi-rotulo">Experimentais pendentes</span>
              <span className="chk-kpi-valor">{experimentais.length}</span>
              <span className="chk-kpi-nota">{experimentais.length ? "Aguardando sua confirmação" : "Tudo respondido"}</span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Mensalidades em atraso</span>
              <span className="chk-kpi-valor">{vencidas.length}</span>
              <span className="chk-kpi-nota">alunos com mês anterior em aberto</span>
            </div>
          </div>

          <div className="chk-corpo">
            <section className="alunos-card inicio-aulas">
              <div className="alunos-filtros">
                <h2 className="chk-secao-titulo">Aulas de hoje</h2>
                {modalidadesHoje.length > 1 && (
                  <div className="toggle-grid" role="group" aria-label="Filtrar por modalidade">
                    {["todas", ...modalidadesHoje].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={modalidade === m ? "toggle-chip active" : "toggle-chip"}
                        onClick={() => setModalidade(m)}
                      >
                        {m === "todas" ? "Todas" : m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {aulasVisiveis.length === 0 ? (
                <p className="alunos-vazio">Nenhuma aula hoje.</p>
              ) : (
                <div className="alunos-tabela" role="table" aria-label="Aulas de hoje">
                  <div className="alunos-linha inicio-grade alunos-cabecalho" role="row">
                    <span role="columnheader">Hora</span>
                    <span role="columnheader">Turma</span>
                    <span role="columnheader">Quadra</span>
                    <span role="columnheader">Ocupação</span>
                  </div>
                  {aulasVisiveis.map(({ turma: t, alunos }) => {
                    const pct = t.capacidade > 0 ? Math.min(100, Math.round((alunos / t.capacidade) * 100)) : 0;
                    return (
                      <div className="alunos-linha inicio-grade" role="row" key={t.id}>
                        <span className="inicio-hora" role="cell">
                          {horaCurta(t.horario)}
                        </span>
                        <div className="alunos-pessoa-texto" role="cell">
                          <span className="alunos-nome">
                            {t.modalidade.nome} <CategoriaBadge nome={t.categoria.nome} cor={t.categoria.cor} />
                          </span>
                          <span className="alunos-sub">com {t.vinculo.professor.nome}</span>
                        </div>
                        <span role="cell" data-rotulo="Quadra">
                          {t.quadra.nome}
                        </span>
                        <span role="cell" data-rotulo="Ocupação" className="turmas-vagas">
                          <span className="turmas-trilho">
                            <span className={classeBarra(pct)} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="turmas-contagem">
                            {alunos}/{t.capacidade}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <PedidosExperimentais pedidos={experimentais} onMudanca={carregar} />
          </div>

          <div className="chk-corpo inicio-segunda-linha">
            <section className="alunos-card inicio-aulas">
              <div className="inicio-grafico-topo">
                <h2 className="chk-secao-titulo">Ocupação por horário</h2>
                <span className="alunos-sub">Alunos mensais / vagas das turmas de cada hora</span>
              </div>
              {porHora.length === 0 ? (
                <p className="alunos-vazio">Nenhuma turma ativa ainda.</p>
              ) : (
                <>
                  <div className="inicio-grafico" role="img" aria-label="Ocupação por horário">
                    {porHora.map((h) => (
                      <div className="inicio-grafico-coluna" key={h.hora} title={`${h.hora}h: ${h.pct}% ocupado`}>
                        <span className="inicio-grafico-valor">{h.pct}%</span>
                        <span
                          className={h.pct >= 80 ? "inicio-grafico-barra cheia" : "inicio-grafico-barra"}
                          style={{ height: `${Math.max(h.pct, 4)}%` }}
                        />
                        <span className="alunos-sub">{h.hora}h</span>
                      </div>
                    ))}
                  </div>
                  <div className="chk-legenda">
                    <span>
                      <i className="inicio-legenda-cor cheia" /> 80% ou mais
                    </span>
                    <span>
                      <i className="inicio-legenda-cor" /> Abaixo de 80%: espaço pra mais alunos
                    </span>
                  </div>
                </>
              )}
            </section>

            <section className="inicio-checkins">
              <h2 className="chk-secao-titulo">Check-ins de hoje</h2>
              {(["wellhub", "totalpass"] as const).map((p) => (
                <div className="inicio-checkins-linha" key={p}>
                  <span>{p === "wellhub" ? "Wellhub" : "TotalPass"}</span>
                  <span className="inicio-checkins-numero">
                    {checkinsHoje.filter((c) => c.plataforma === p).length}
                  </span>
                </div>
              ))}
              <div className="inicio-checkins-linha">
                <span>Alunos com check-in faltando no mês</span>
                <span className="inicio-checkins-numero">{comFalta.length}</span>
              </div>
              <Link to="/admin-point/wellhub" className="inicio-checkins-link">
                Controle de check-ins <Icon name="chevron-right" size={14} />
              </Link>
            </section>
          </div>

          <div className="toggle-grid inicio-atalhos" aria-label="Atalhos">
            {[
              { para: "/admin-point/aluno", rotulo: "Alunos", icone: "user-check" as IconName },
              { para: "/admin-point/professor", rotulo: "Professores", icone: "users" as IconName },
              { para: "/admin-point/turmas", rotulo: "Turmas", icone: "grid" as IconName },
              { para: "/admin-point/ocupacao", rotulo: "Ocupação de quadra", icone: "chart" as IconName },
              { para: "/admin-point/wellhub", rotulo: "Checkins", icone: "check-circle" as IconName },
            ].map((a) => (
              <Link key={a.para} to={a.para} className="toggle-chip inicio-atalho">
                <Icon name={a.icone} size={16} /> {a.rotulo}
              </Link>
            ))}
          </div>

          {point && point.banners.length > 0 && (
            <div className="inicio-bloco-point">
              <Carrossel fotos={point.banners} contido />
            </div>
          )}

          {point && (point.fotos.length > 0 || point.sobre || point.informacoes_importantes) && (
            <section className="alunos-card inicio-bloco-point">
              <h2 className="chk-secao-titulo">Seu Point pros alunos</h2>
              <span className="alunos-sub">
                <Icon name="pin" size={14} /> {point.endereco}
              </span>
              {point.fotos.length > 0 && <Carrossel fotos={point.fotos} />}
              {point.sobre && (
                <div>
                  <h3>Sobre</h3>
                  <p className="inicio-texto-point">{point.sobre}</p>
                </div>
              )}
              {point.informacoes_importantes && (
                <div>
                  <h3>Informações importantes</h3>
                  <p className="inicio-texto-point">{point.informacoes_importantes}</p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </Layout>
  );
}

/** Pedidos de aula experimental pendentes, pra responder ali mesmo
 * (kit: "Confirme para avisar o aluno no WhatsApp"). */
function PedidosExperimentais({
  pedidos,
  onMudanca,
}: {
  pedidos: SolicitacaoExperimental[];
  onMudanca: () => void;
}) {
  const [processando, setProcessando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: number, acao: "aprovar" | "recusar") {
    setErro(null);
    setProcessando(id);
    try {
      await api.patch(`/experimental/solicitacoes/${id}/${acao}`, acao === "recusar" ? { motivo_recusa: null } : {});
      onMudanca();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível responder. Tente de novo.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <aside className="alunos-card chk-recebidos">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">Aulas experimentais</h2>
        {pedidos.length > 0 && (
          <span className="status-pill status-good">{plural(pedidos.length, "pendente", "pendentes")}</span>
        )}
      </div>
      <p className="alunos-sub inicio-exp-explica">
        Pedidos feitos pela página pública. Ao confirmar, o visitante é avisado pelo WhatsApp.
      </p>
      {erro && <p className="form-error">{erro}</p>}
      {pedidos.length === 0 && <p className="empty-state">Nenhum pedido aguardando resposta.</p>}
      {pedidos.slice(0, 4).map((s) => (
        <div className="inicio-exp-pedido" key={s.id}>
          <div className="inicio-exp-linha">
            <div className="alunos-pessoa-texto">
              <span className="alunos-nome">{s.nome}</span>
              <span className="alunos-sub">
                {s.turma.modalidade.nome} · {s.turma.categoria.nome}
              </span>
            </div>
            <span className="inicio-exp-quando">
              {new Date(s.data + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
              {horaCurta(s.turma.horario)}
            </span>
          </div>
          <div className="inicio-exp-botoes">
            <button type="button" disabled={processando !== null} onClick={() => decidir(s.id, "aprovar")}>
              {processando === s.id ? "..." : "Confirmar"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={processando !== null}
              onClick={() => decidir(s.id, "recusar")}
            >
              Recusar
            </button>
          </div>
        </div>
      ))}
      {pedidos.length > 4 && (
        <Link to="/admin-point/experimental" className="inicio-checkins-link inicio-link-claro">
          Ver todos os {pedidos.length} pedidos <Icon name="chevron-right" size={14} />
        </Link>
      )}
    </aside>
  );
}
