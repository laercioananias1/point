import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { Checkin, Feriado, Matricula, SolicitacaoExperimental, TurmaResumo } from "../api/types";
import { CategoriaBadge } from "./CategoriaBadge";
import { Icon } from "./Layout";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";
import { horarioFim } from "../lib/dias";
import { buscarFeriadosPorPoint } from "../lib/feriados";

export interface OcorrenciaTurma {
  turmaId: number;
  data: Date;
  horario: string;
  duracaoMinutos: number;
  modalidadeNome: string;
  pointNome: string;
  quadraNome: string;
  professorNome: string;
  capacidade: number;
  // Categoria/nível da turma (pedido do usuário, 2026-09-08) — pra
  // destacar visualmente na agenda com a cor cadastrada pelo Point.
  categoriaNome: string;
  categoriaCor: string;
  // Aula cancelada por força maior nessa data, com motivo (pedido do
  // usuário, 2026-09-01: "essa informação precisa aparecer no calendário
  // com um ícone tb de cancelamento e mostrar motivo") — antes essas
  // datas simplesmente desapareciam do calendário (t.excecoes.includes),
  // agora viram uma ocorrência "cancelada" em vez de sumir.
  cancelada: boolean;
  motivoCancelamento: string | null;
}

/** Feriados (nacional + local) de todos os Points envolvidos, num único
 * mapa data→nome — pedido do usuário, 2026-09-01, depois de reparar que
 * 25/12 não tinha ícone nenhum: feriado precisa aparecer no calendário
 * MESMO quando nenhuma turma tem aula programada naquele dia da semana
 * (ex.: Natal cai numa sexta, mas nenhuma turma dá aula às sextas) — não
 * dá pra depender só de "essa turma tinha aula aqui e foi cancelada",
 * porque aí um feriado sem turma nenhuma naquele dia simplesmente some. */
export function feriadosNoMapa(
  turmas: TurmaResumo[],
  feriadosPorPoint: Record<number, Feriado[]>,
): Map<string, string> {
  const mapa = new Map<string, string>();
  const pointIds = new Set(turmas.map((t) => t.vinculo.point_id));
  for (const id of pointIds) {
    for (const f of feriadosPorPoint[id] ?? []) {
      mapa.set(f.data, f.nome);
    }
  }
  return mapa;
}

/** Ocorrências de todas as turmas passadas dentro das datas visíveis —
 * mesma ideia de app.services.aulas (dia_semana × período), só que
 * calculado no cliente pra alimentar os pontinhos do calendário.
 *
 * Feriado (pedido do usuário, 2026-09-01: "o sistema... não pode criar
 * [aula] nesses dias de feriados") não vira uma ocorrência "cancelada"
 * aqui — o backend (gerar_aulas_do_mes) nunca gera Aula num feriado, então
 * a turma simplesmente não aparece nesse dia (igual sempre fez com
 * exceção sem motivo); o aviso "hoje é feriado" é mostrado à parte, via
 * `feriadosNoMapa` acima, independente de ter turma rodando ou não. */
export function ocorrenciasEmDatas(
  turmas: TurmaResumo[],
  datas: Date[],
  feriadosPorData: Map<string, string>,
): Map<string, OcorrenciaTurma[]> {
  const mapa = new Map<string, OcorrenciaTurma[]>();
  const adicionar = (iso: string, oc: OcorrenciaTurma) => {
    const lista = mapa.get(iso);
    if (lista) lista.push(oc);
    else mapa.set(iso, [oc]);
  };

  for (const t of turmas) {
    const cancelamentosPorData = new Map(t.cancelamentos.map((c) => [c.data, c.motivo]));
    for (const data of datas) {
      const iso = toISODate(data);
      if (iso < t.periodo_inicio) continue;
      if (t.periodo_fim !== null && iso > t.periodo_fim) continue;
      if (!t.dias_semana.includes(diaSemanaDeData(data))) continue;
      if (feriadosPorData.has(iso)) continue;

      const cancelada = t.excecoes.includes(iso);
      const motivoCancelamento = cancelamentosPorData.get(iso) ?? null;
      if (cancelada && motivoCancelamento === null) continue; // exceção antiga, sem motivo — some como antes

      adicionar(iso, {
        turmaId: t.id,
        data,
        horario: t.horario,
        duracaoMinutos: t.duracao_minutos,
        modalidadeNome: t.modalidade.nome,
        pointNome: t.vinculo.point.nome,
        quadraNome: t.quadra.nome,
        professorNome: t.vinculo.professor.nome,
        capacidade: t.capacidade,
        categoriaNome: t.categoria.nome,
        categoriaCor: t.categoria.cor,
        cancelada,
        motivoCancelamento,
      });
    }
  }
  return mapa;
}

export type Granularidade = "dia" | "semana" | "mes";

/** Datas exibidas conforme a granularidade (pedido do usuário, 2026-09-21:
 * "troca para semana e mês não muda a agenda") — dia: só o selecionado;
 * semana: seg→dom da semana dele; mês: todos os dias do mês dele. */
export function datasDoPeriodo(ref: Date, passo: Granularidade): Date[] {
  if (passo === "dia") return [ref];
  if (passo === "semana") {
    const inicio = inicioDaSemana(ref);
    return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  }
  const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return Array.from({ length: ultimo }, (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1));
}

export function minutosDoHorario(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

function hexParaRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** Uma pessoa esperada numa ocorrência — aluno matriculado ou visitante
 * de aula experimental aprovada (pedido do usuário, 2026-09-15: "na
 * realidade o experimental é quase um aluno, ele só não tem uma senha
 * para entrar") — mesma lista/checklist de presença pros dois, só o
 * `tipo` decide qual endpoint marcar/desmarcar chama. */
export type Pessoa = { id: number; nome: string; tipo: "matricula" | "experimental" };

/** Essa matrícula tem mesmo aula nessa turma nessa data — espelha
 * app.services.aulas::matricula_tem_aula_em (pedido do usuário,
 * 2026-08-26: "mostrar também os alunos e um check pra marcar presença de
 * cada um" — o backend valida de novo, isso só decide quem aparece na
 * lista). */
export function matriculaTemAulaEm(m: Matricula, turmaId: number, iso: string, diaSemana: string): boolean {
  if (m.status !== "ativa" || m.turma_id !== turmaId) return false;
  if (m.tipo === "mensal") {
    if (iso < m.data_inicio_efetiva) return false;
    if (m.turma.periodo_fim !== null && iso > m.turma.periodo_fim) return false;
    if (!m.dias_semana.includes(diaSemana)) return false;
    const excluidas = new Set([...m.turma.excecoes, ...m.excecoes]);
    return !excluidas.has(iso);
  }
  return m.data_inicio_efetiva === iso;
}

/** Calendário de agenda por turma — pontinho por dia + lista de ocorrências
 * do dia selecionado com checklist de presença (pedido do usuário,
 * 2026-08-25/26: professor primeiro, depois "cria o Agenda também [pro
 * admin], igual professor"). Compartilhado entre a Agenda do professor
 * (só as próprias turmas) e a do admin (o Point inteiro, com filtro de
 * professor) — quem chama já entrega a lista de turmas/matrículas
 * filtrada como quiser. */
export function AgendaTurmasCalendario({
  turmas,
  matriculas,
  solicitacoesExperimentais = [],
  onMudanca,
}: {
  turmas: TurmaResumo[];
  matriculas: Matricula[];
  // Só as aprovadas contam como gente esperada na aula (pedido do
  // usuário, 2026-09-15) — quem chama já filtra status=aprovada.
  solicitacoesExperimentais?: SolicitacaoExperimental[];
  onMudanca: () => void;
}) {
  const [removendo, setRemovendo] = useState<{ ocorrencia: OcorrenciaTurma; alunosCount: number } | null>(
    null,
  );
  // Cancelar a aula de UM aluno específico (pedido do usuário,
  // 2026-09-01: "o professor pode cancelar uma aula de um determinado
  // aluno de última hora") — diferente de `removendo`, que cancela a
  // turma inteira nessa data.
  const [cancelandoAluno, setCancelandoAluno] = useState<{
    matriculaId: number;
    nome: string;
    ocorrencia: OcorrenciaTurma;
  } | null>(null);
  // Detalhe de UMA ocorrência (pedido do usuário, 2026-09-15: grade por
  // quadra/horário no lugar da lista empilhada — não sobra espaço pra
  // mostrar presença/cancelar dentro do bloco). Era um modal; no layout do
  // kit (design/telas/Agenda.dc.html, pedido do usuário, 2026-10-01) virou
  // o painel ao lado da grade.
  const [detalheAberto, setDetalheAberto] = useState<OcorrenciaTurma | null>(null);
  const painelRef = useRef<HTMLElement>(null);
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [passo, setPasso] = useState<Granularidade>("dia");

  // Feriados (pedido do usuário, 2026-09-01) — busca própria, mesmo
  // padrão já usado por PresencaLista logo abaixo neste arquivo. Por
  // point_id: um professor pode dar aula em mais de um Point.
  const pointIds = useMemo(
    () => Array.from(new Set(turmas.map((t) => t.vinculo.point_id))),
    [turmas],
  );
  const [feriadosPorPoint, setFeriadosPorPoint] = useState<Record<number, Feriado[]>>({});
  useEffect(() => {
    if (pointIds.length === 0) return;
    buscarFeriadosPorPoint(pointIds).then(setFeriadosPorPoint);
  }, [pointIds]);

  const feriadosPorData = useMemo(
    () => feriadosNoMapa(turmas, feriadosPorPoint),
    [turmas, feriadosPorPoint],
  );
  // Só o dia selecionado (pedido do usuário, 2026-09-15: "remove esse
  // calendario de cima" — sem grade de mês/semana com pontinho, não tem
  // mais janela "visível" nenhuma pra calcular; ocorrenciasEmDatas aceita
  // uma lista de 1 dia só sem problema).
  // Agora acompanha a granularidade (Dia/Semana/Mês) — o dia selecionado
  // sempre está dentro do período exibido.
  const datasVisiveis = useMemo(() => datasDoPeriodo(diaSelecionado, passo), [diaSelecionado, passo]);
  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(turmas, datasVisiveis, feriadosPorData),
    [turmas, datasVisiveis, feriadosPorData],
  );
  const ocorrenciasDoDia = ocorrenciasPorDia.get(toISODate(diaSelecionado)) ?? [];
  const ocorrenciasAtivasPeriodo = Array.from(ocorrenciasPorDia.values())
    .flat()
    .filter((oc) => !oc.cancelada);
  const nomeFeriadoDoDia = feriadosPorData.get(toISODate(diaSelecionado)) ?? null;

  // Gente esperada numa ocorrência — matrícula ou visitante de aula
  // experimental aprovada (pedido do usuário, 2026-09-15: "quase um
  // aluno, só não tem senha") — extraído em função porque agora precisa
  // tanto pro rótulo do bloco na grade quanto pro modal de detalhe.
  function pessoasDaOcorrencia(oc: OcorrenciaTurma): Pessoa[] {
    const iso = toISODate(oc.data);
    const diaSemana = diaSemanaDeData(oc.data);
    return [
      ...matriculas
        .filter((m) => matriculaTemAulaEm(m, oc.turmaId, iso, diaSemana))
        .map((m): Pessoa => ({ id: m.id, nome: m.aluno.nome, tipo: "matricula" })),
      ...solicitacoesExperimentais
        .filter((s) => s.turma.id === oc.turmaId && s.data === iso)
        .map((s): Pessoa => ({ id: s.id, nome: s.nome, tipo: "experimental" })),
    ];
  }

  // De onde vem cada aluno, pro painel de presença (mesma leitura do
  // Início do professor).
  const origemPorMatricula = useMemo(
    () =>
      new Map(
        matriculas.map((m) => [
          m.id,
          m.fonte_pagamento === "wellhub"
            ? "Wellhub"
            : m.fonte_pagamento === "totalpass"
              ? "TotalPass"
              : m.tipo === "mensal"
                ? "Mensalista"
                : "Avulso",
        ]),
      ),
    [matriculas],
  );

  // O painel só mostra aula do período que está na tela — trocar de dia ou
  // de semana limpa a seleção. No Mês não tem painel: clicar no dia abre a
  // agenda daquele dia.
  const detalhe =
    detalheAberto &&
    passo !== "mes" &&
    datasVisiveis.some((d) => toISODate(d) === toISODate(detalheAberto.data))
      ? detalheAberto
      : null;
  const chaveDetalhe = detalhe ? `${detalhe.turmaId}-${toISODate(detalhe.data)}` : null;

  function abrirDetalhe(oc: OcorrenciaTurma) {
    setDetalheAberto(oc);
    // No celular o painel fica embaixo da grade — rola até ele.
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => painelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const ocorrenciasAtivas = ocorrenciasDoDia.filter((oc) => !oc.cancelada);
  const ocorrenciasCanceladas = ocorrenciasDoDia.filter((oc) => oc.cancelada);

  // Colunas por quadra (pedido do usuário, 2026-09-15: "da para ficar
  // parecida com esse exemplo de agenda" — grade quadra × horário, não
  // lista empilhada) — vem de todas as turmas, não só as do dia
  // selecionado, pra não "pular" coluna ao trocar de dia.
  const quadras = Array.from(new Set(turmas.map((t) => t.quadra.nome))).sort();

  const horaInicioGrade = ocorrenciasAtivasPeriodo.length
    ? Math.max(
        0,
        Math.min(...ocorrenciasAtivasPeriodo.map((oc) => Math.floor(minutosDoHorario(oc.horario) / 60))) - 1,
      )
    : 7;
  const horaFimGrade = ocorrenciasAtivasPeriodo.length
    ? Math.min(
        24,
        Math.max(
          ...ocorrenciasAtivasPeriodo.map((oc) =>
            Math.ceil((minutosDoHorario(oc.horario) + oc.duracaoMinutos) / 60),
          ),
        ) + 1,
      )
    : 21;
  const horasDaGrade = Array.from(
    { length: Math.max(1, horaFimGrade - horaInicioGrade) },
    (_, i) => horaInicioGrade + i,
  );
  const alturaGrade = (horaFimGrade - horaInicioGrade) * 60;

  const agora = new Date();
  const ehHoje = toISODate(diaSelecionado) === toISODate(agora);
  const offsetAgora = agora.getHours() * 60 + agora.getMinutes() - horaInicioGrade * 60;

  if (turmas.length === 0) {
    return <p className="empty-state">Nenhuma turma ainda.</p>;
  }

  return (
    <>
      {removendo && (
        <GerenciarAulaModal
          ocorrencia={removendo.ocorrencia}
          alunosCount={removendo.alunosCount}
          onFechar={() => setRemovendo(null)}
          onRemovido={() => {
            setRemovendo(null);
            onMudanca();
          }}
        />
      )}

      {cancelandoAluno && (
        <CancelarAulaAlunoModal
          nomeAluno={cancelandoAluno.nome}
          matriculaId={cancelandoAluno.matriculaId}
          ocorrencia={cancelandoAluno.ocorrencia}
          onFechar={() => setCancelandoAluno(null)}
          onCancelado={() => {
            setCancelandoAluno(null);
            onMudanca();
          }}
        />
      )}

      <AgendaDiaNav
        diaSelecionado={diaSelecionado}
        onSelecionarDia={setDiaSelecionado}
        passo={passo}
        onMudarPasso={setPasso}
        diasComAula={(d) => (ocorrenciasPorDia.get(toISODate(d)) ?? []).some((oc) => !oc.cancelada)}
        resumo={
          ocorrenciasAtivasPeriodo.length > 0
            ? (() => {
                // Resumo do período (pedido do usuário, 2026-09-15: "tambem
                // mostra % ocupacao e qtde de alunos") — vagas ocupadas
                // contam por aula; "Alunos" conta pessoas distintas (na
                // semana/mês o mesmo aluno aparece em várias aulas).
                const capacidade = ocorrenciasAtivasPeriodo.reduce((soma, oc) => soma + oc.capacidade, 0);
                const ocupadas = ocorrenciasAtivasPeriodo.reduce(
                  (soma, oc) => soma + pessoasDaOcorrencia(oc).length,
                  0,
                );
                const pessoas = new Set(
                  ocorrenciasAtivasPeriodo.flatMap((oc) =>
                    pessoasDaOcorrencia(oc).map((p) => `${p.tipo}:${p.id}`),
                  ),
                ).size;
                const aulas = ocorrenciasAtivasPeriodo.length;
                const ocupacao = capacidade > 0 ? Math.round((ocupadas / capacidade) * 100) : 0;
                return (
                  <>
                    <span>
                      <strong>{aulas}</strong> {aulas === 1 ? "aula" : "aulas"}
                    </span>
                    <span>
                      <strong>{ocupacao}%</strong> ocupação
                    </span>
                    <span>
                      <strong>{pessoas}</strong> {pessoas === 1 ? "aluno" : "alunos"}
                    </span>
                  </>
                );
              })()
            : null
        }
      />

      {passo === "dia" && nomeFeriadoDoDia && (
        <p className="agenda-feriado">
          <Icon name="flag" size={16} /> Feriado: {nomeFeriadoDoDia}
        </p>
      )}

      <div className="agenda-layout">
        <section className="alunos-card agenda-grade-card">
          {passo === "dia" &&
            (ocorrenciasDoDia.length === 0 ? (
              <p className="alunos-vazio">
                {nomeFeriadoDoDia ? "Feriado — sem aulas nesse dia." : "Nenhuma aula nesse dia."}
              </p>
            ) : (
              <>
                {ocorrenciasAtivas.length > 0 && (
                  <div className="agenda-timeline">
                    <div className="agenda-timeline-header">
                      <div className="agenda-timeline-corner" />
                      {quadras.map((q) => (
                        <div key={q} className="agenda-timeline-quadra-pill">
                          {q}
                        </div>
                      ))}
                    </div>
                    <div className="agenda-timeline-body" style={{ height: alturaGrade }}>
                      <div className="agenda-timeline-horas">
                        {horasDaGrade.map((h) => (
                          <span
                            key={h}
                            className="agenda-timeline-hora-label"
                            style={{ top: (h - horaInicioGrade) * 60 }}
                          >
                            {h}h
                          </span>
                        ))}
                      </div>
                      {horasDaGrade.map((h) => (
                        <div
                          key={h}
                          className="agenda-timeline-linha"
                          style={{ top: (h - horaInicioGrade) * 60 }}
                        />
                      ))}
                      {ehHoje && offsetAgora >= 0 && offsetAgora <= alturaGrade && (
                        <div className="agenda-timeline-agora" style={{ top: offsetAgora }} />
                      )}
                      <div className="agenda-timeline-colunas">
                        {quadras.map((q) => (
                          <div key={q} className="agenda-timeline-coluna">
                            {ocorrenciasAtivas
                              .filter((oc) => oc.quadraNome === q)
                              .map((oc) => {
                                const pessoas = pessoasDaOcorrencia(oc);
                                const top = minutosDoHorario(oc.horario) - horaInicioGrade * 60;
                                const selecionado = chaveDetalhe === `${oc.turmaId}-${toISODate(oc.data)}`;
                                return (
                                  <button
                                    key={oc.turmaId}
                                    type="button"
                                    className={`agenda-timeline-bloco${selecionado ? " selecionado" : ""}`}
                                    aria-pressed={selecionado}
                                    style={{
                                      top,
                                      height: Math.max(oc.duracaoMinutos, 34),
                                      background: hexParaRgba(oc.categoriaCor, 0.2),
                                      borderColor: oc.categoriaCor,
                                      color: oc.categoriaCor,
                                    }}
                                    onClick={() => abrirDetalhe(oc)}
                                  >
                                    <span className="agenda-timeline-bloco-titulo">{oc.categoriaNome}</span>
                                    <span className="agenda-timeline-bloco-sub">
                                      {pessoas.length}/{oc.capacidade}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {ocorrenciasCanceladas.length > 0 && (
                  <div className="agenda-canceladas">
                    {ocorrenciasCanceladas.map((oc, i) => (
                      <div key={i} className="agenda-cancelada">
                        <span className="agenda-cancelada-titulo">
                          <Icon name="x-circle" size={16} /> {oc.horario} –{" "}
                          {horarioFim(oc.horario, oc.duracaoMinutos)} cancelada
                        </span>
                        <span className="alunos-sub">
                          <CategoriaBadge nome={oc.categoriaNome} cor={oc.categoriaCor} /> · {oc.modalidadeNome}{" "}
                          · com {oc.professorNome} · {oc.quadraNome}
                        </span>
                        {oc.motivoCancelamento && (
                          <span className="alunos-sub">Motivo: {oc.motivoCancelamento}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ))}

          {passo === "semana" && ocorrenciasPorDia.size === 0 && (
            <p className="alunos-vazio">Nenhuma aula nessa semana.</p>
          )}

          {passo === "semana" && ocorrenciasPorDia.size > 0 && (
            <AgendaSemana
              datas={datasVisiveis}
              ocorrenciasPorDia={ocorrenciasPorDia}
              feriadosPorData={feriadosPorData}
              horaInicioGrade={horaInicioGrade}
              horasDaGrade={horasDaGrade}
              alturaGrade={alturaGrade}
              pessoasDaOcorrencia={pessoasDaOcorrencia}
              chaveSelecionada={chaveDetalhe}
              onAbrir={abrirDetalhe}
              onIrParaDia={(d) => {
                setDiaSelecionado(d);
                setPasso("dia");
              }}
            />
          )}

          {passo === "mes" && (
            <AgendaMes
              referencia={diaSelecionado}
              ocorrenciasPorDia={ocorrenciasPorDia}
              feriadosPorData={feriadosPorData}
              pessoasDaOcorrencia={pessoasDaOcorrencia}
              onIrParaDia={(d) => {
                setDiaSelecionado(d);
                setPasso("dia");
              }}
            />
          )}
        </section>

        {passo !== "mes" && (
          <aside className="alunos-card agenda-detalhe" ref={painelRef}>
            {detalhe ? (
              <DetalheOcorrencia
                key={chaveDetalhe}
                ocorrencia={detalhe}
                pessoas={pessoasDaOcorrencia(detalhe)}
                origemPorMatricula={origemPorMatricula}
                onFechar={() => setDetalheAberto(null)}
                onCancelarTurma={(alunosCount) => setRemovendo({ ocorrencia: detalhe, alunosCount })}
                onCancelarAluno={(matriculaId, nome) =>
                  setCancelandoAluno({ matriculaId, nome, ocorrencia: detalhe })
                }
              />
            ) : (
              <p className="agenda-detalhe-vazio">
                Toque em uma aula na agenda para ver os alunos e marcar presença.
              </p>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

/** Presença de uma ocorrência (turma + data): quem já tem check-in
 * confirmado e o alternar marcar/desmarcar — compartilhado entre a lista
 * de presença da Agenda e o Início do professor (pedido do usuário,
 * 2026-10-01). Chave combinada `tipo:id` (pedido do usuário, 2026-09-15:
 * visitante experimental "quase um aluno") — matricula_id e
 * solicitacao_experimental_id são FKs de tabelas diferentes, podem
 * colidir no mesmo número. */
export function usePresenca(turmaId: number, iso: string) {
  const chave = (p: Pessoa) => `${p.tipo}:${p.id}`;
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [carregado, setCarregado] = useState(false);
  const [alterando, setAlterando] = useState<string | null>(null);

  useEffect(() => {
    setCarregado(false);
    api
      .get<Checkin[]>(`/checkins/turma/${turmaId}?data=${iso}`)
      .then((checkins) => {
        setPresentes(
          new Set(
            checkins.flatMap((c) => {
              if (c.matricula_id !== null) return [`matricula:${c.matricula_id}`];
              if (c.solicitacao_experimental_id !== null) {
                return [`experimental:${c.solicitacao_experimental_id}`];
              }
              return [];
            }),
          ),
        );
      })
      .finally(() => setCarregado(true));
  }, [turmaId, iso]);

  async function alternar(p: Pessoa) {
    const k = chave(p);
    setAlterando(k);
    try {
      if (presentes.has(k)) {
        if (p.tipo === "matricula") {
          await api.delete(`/checkins/presenca?turma_id=${turmaId}&matricula_id=${p.id}&data=${iso}`);
        } else {
          await api.delete(`/checkins/presenca-experimental?solicitacao_experimental_id=${p.id}`);
        }
        setPresentes((atual) => {
          const proximo = new Set(atual);
          proximo.delete(k);
          return proximo;
        });
      } else {
        if (p.tipo === "matricula") {
          await api.post("/checkins/presenca", { turma_id: turmaId, matricula_id: p.id, data: iso });
        } else {
          await api.post("/checkins/presenca-experimental", { solicitacao_experimental_id: p.id });
        }
        setPresentes((atual) => new Set(atual).add(k));
      }
    } finally {
      setAlterando(null);
    }
  }

  return { presentes, carregado, alterando, alternar, chave };
}

/** Checklist de presença dos alunos esperados nessa ocorrência (pedido do
 * usuário, 2026-08-26: "mostrar também os alunos e um check pra marcar
 * presença de cada um"). Cada marcação é um Checkin de origem "presumido" —
 * o backend confere de novo se esse aluno realmente tem aula nessa data
 * antes de marcar. Botão Presente/Marcar do kit (Agenda.dc.html). */
function PresencaLista({
  pessoas,
  origemPorMatricula,
  presenca,
  onCancelarAluno,
}: {
  pessoas: Pessoa[];
  origemPorMatricula: Map<number, string>;
  presenca: ReturnType<typeof usePresenca>;
  // Cancelar a aula de UM aluno específico, não a turma inteira (pedido
  // do usuário, 2026-09-01: "o professor pode cancelar uma aula de um
  // determinado aluno de última hora, precisa informar o motivo e opção
  // de gerar crédito ou não") — só existe pra aluno matriculado; visitante
  // de aula experimental não tem esse fluxo (nem crédito nem matrícula
  // pra cancelar).
  onCancelarAluno: (matriculaId: number, nome: string) => void;
}) {
  const { presentes, carregado, alterando, alternar, chave } = presenca;

  if (pessoas.length === 0) {
    return <p className="alunos-sub">Nenhum aluno matriculado nessa aula.</p>;
  }

  return (
    <div className="agenda-presenca">
      <span className="prof-aulas-titulo agenda-presenca-titulo">Presença · confirmada pelo professor</span>
      {pessoas.map((p) => {
        const presente = presentes.has(chave(p));
        const iniciais = p.nome
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((parte) => parte[0].toUpperCase())
          .join("");
        return (
          <div key={chave(p)} className="agenda-presenca-linha">
            <span className="agenda-presenca-avatar">{iniciais}</span>
            <span className="alunos-pessoa-texto agenda-presenca-pessoa">
              <span className="alunos-nome">{p.nome}</span>
              <span className="alunos-sub">
                {p.tipo === "experimental" ? "Aula experimental" : origemPorMatricula.get(p.id) ?? "Aluno"}
                {p.tipo === "matricula" && (
                  <>
                    {" · "}
                    <button type="button" className="alunos-acao" onClick={() => onCancelarAluno(p.id, p.nome)}>
                      cancelar aula dele
                    </button>
                  </>
                )}
              </span>
            </span>
            <button
              type="button"
              className={`prof-presenca-botao${presente ? " presente" : ""}`}
              disabled={!carregado || alterando === chave(p)}
              aria-label={`Presença de ${p.nome}: ${presente ? "presente" : "não marcada"}`}
              onClick={() => alternar(p)}
            >
              {presente ? (
                <>
                  <Icon name="check" size={14} /> Presente
                </>
              ) : (
                "Marcar"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Navegação do período exibido (pedido do usuário, 2026-09-15: "deixa
 * somente o debaixo com dia, semana e mês"; 2026-09-21: "troca para semana
 * e mês não muda a agenda") — o passo escolhido (Dia/Semana/Mês) define o
 * que a agenda mostra abaixo e o quanto as setinhas andam. */
export function AgendaDiaNav({
  diaSelecionado,
  onSelecionarDia,
  passo,
  onMudarPasso,
  diasComAula,
  resumo,
}: {
  diaSelecionado: Date;
  onSelecionarDia: (data: Date) => void;
  passo: Granularidade;
  onMudarPasso: (passo: Granularidade) => void;
  diasComAula: (data: Date) => boolean;
  // Números do período, ao lado da data (cada agenda decide o que mostrar).
  resumo?: ReactNode;
}) {
  function navegar(direcao: 1 | -1) {
    if (passo === "semana") {
      onSelecionarDia(somarDias(diaSelecionado, direcao * 7));
    } else if (passo === "mes") {
      // Dia 31 + 1 mês não pode virar o mês seguinte ao seguinte (31/jan →
      // "31/fev" = 3/mar) — limita ao último dia do mês de destino.
      const alvo = new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth() + direcao, 1);
      const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      alvo.setDate(Math.min(diaSelecionado.getDate(), ultimo));
      onSelecionarDia(alvo);
    } else {
      onSelecionarDia(somarDias(diaSelecionado, direcao));
    }
  }

  let rotulo: string;
  if (passo === "mes") {
    rotulo = diaSelecionado
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase());
  } else if (passo === "semana") {
    const inicio = inicioDaSemana(diaSelecionado);
    const fim = somarDias(inicio, 6);
    const mesFim = fim.toLocaleDateString("pt-BR", { month: "long" });
    rotulo =
      inicio.getMonth() === fim.getMonth()
        ? `${inicio.getDate()} – ${fim.getDate()} de ${mesFim}`
        : `${inicio.getDate()} de ${inicio.toLocaleDateString("pt-BR", { month: "long" })} – ${fim.getDate()} de ${mesFim}`;
  } else {
    rotulo = diaSelecionado
      .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  const hoje = toISODate(new Date());
  const selecionadoIso = toISODate(diaSelecionado);
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(diaSelecionado), i));

  return (
    <div className="agenda-nav">
      <div className="agenda-nav-linha">
        <div className="agenda-nav-periodo">
          <button type="button" className="agenda-seta" onClick={() => navegar(-1)} aria-label="Anterior">
            <Icon name="chevron-left" size={18} />
          </button>
          {passo === "dia" ? (
            <div className="agenda-dias" role="tablist" aria-label="Dias da semana">
              {semana.map((d, i) => {
                const iso = toISODate(d);
                const classes = ["agenda-dia"];
                if (iso === selecionadoIso) classes.push("escolhido");
                else if (iso === hoje) classes.push("hoje");
                return (
                  <button
                    key={iso}
                    type="button"
                    role="tab"
                    aria-selected={iso === selecionadoIso}
                    className={classes.join(" ")}
                    onClick={() => onSelecionarDia(d)}
                  >
                    <span className="agenda-dia-letra">{ROTULO_DIA_CURTO[i]}</span>
                    <span className="agenda-dia-numero">{d.getDate()}</span>
                    <span className={diasComAula(d) ? "agenda-dia-ponto" : "agenda-dia-ponto vazio"} />
                  </button>
                );
              })}
            </div>
          ) : (
            <h3 className="agenda-nav-rotulo">{rotulo}</h3>
          )}
          <button type="button" className="agenda-seta" onClick={() => navegar(1)} aria-label="Próximo">
            <Icon name="chevron-right" size={18} />
          </button>
          {selecionadoIso !== hoje && (
            <button type="button" className="filtro-pilula agenda-hoje" onClick={() => onSelecionarDia(new Date())}>
              Hoje
            </button>
          )}
        </div>
        <div className="agenda-passos" role="tablist" aria-label="Período">
          {(["dia", "semana", "mes"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={passo === g}
              className={passo === g ? "ativo" : ""}
              onClick={() => onMudarPasso(g)}
            >
              {g === "dia" ? "Dia" : g === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>
      <div className="agenda-nav-resumo">
        {passo === "dia" && <span className="agenda-nav-data">{rotulo}</span>}
        {resumo}
      </div>
    </div>
  );
}

/** Distribui aulas que se sobrepõem no tempo em faixas lado a lado (na
 * semana várias quadras podem ter aula no mesmo horário e a coluna do dia é
 * uma só) — devolve, pra cada aula, a faixa e o total de faixas do grupo
 * de sobreposição dela. */
function distribuirEmFaixas(
  ocorrencias: OcorrenciaTurma[],
): { oc: OcorrenciaTurma; faixa: number; faixas: number }[] {
  const ordenadas = [...ocorrencias].sort(
    (a, b) => minutosDoHorario(a.horario) - minutosDoHorario(b.horario),
  );
  const resultado: { oc: OcorrenciaTurma; faixa: number; faixas: number }[] = [];
  let grupo: typeof resultado = [];
  let fimGrupo = -1;
  const fecharGrupo = () => {
    const faixas = Math.max(1, ...grupo.map((g) => g.faixa + 1));
    for (const g of grupo) g.faixas = faixas;
    resultado.push(...grupo);
    grupo = [];
  };
  for (const oc of ordenadas) {
    const inicio = minutosDoHorario(oc.horario);
    if (grupo.length > 0 && inicio >= fimGrupo) {
      fecharGrupo();
      fimGrupo = -1;
    }
    const usadas = new Set(
      grupo
        .filter((g) => minutosDoHorario(g.oc.horario) + g.oc.duracaoMinutos > inicio)
        .map((g) => g.faixa),
    );
    let faixa = 0;
    while (usadas.has(faixa)) faixa++;
    grupo.push({ oc, faixa, faixas: 1 });
    fimGrupo = Math.max(fimGrupo, inicio + oc.duracaoMinutos);
  }
  fecharGrupo();
  return resultado;
}

export const ROTULO_DIA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Visão de semana (pedido do usuário, 2026-09-21) — 7 colunas (seg→dom) ×
 * horas, mesmo bloco colorido por categoria da visão de dia. Clicar no
 * bloco abre o detalhe; clicar no cabeçalho do dia abre aquele dia. */
function AgendaSemana({
  datas,
  ocorrenciasPorDia,
  feriadosPorData,
  horaInicioGrade,
  horasDaGrade,
  alturaGrade,
  pessoasDaOcorrencia,
  chaveSelecionada,
  onAbrir,
  onIrParaDia,
}: {
  datas: Date[];
  ocorrenciasPorDia: Map<string, OcorrenciaTurma[]>;
  feriadosPorData: Map<string, string>;
  horaInicioGrade: number;
  horasDaGrade: number[];
  alturaGrade: number;
  pessoasDaOcorrencia: (oc: OcorrenciaTurma) => Pessoa[];
  chaveSelecionada: string | null;
  onAbrir: (oc: OcorrenciaTurma) => void;
  onIrParaDia: (d: Date) => void;
}) {
  const hoje = toISODate(new Date());
  return (
    <div className="agenda-timeline">
      <div className="agenda-timeline-header">
        <div className="agenda-timeline-corner" />
        {datas.map((d, i) => {
          const iso = toISODate(d);
          const feriado = feriadosPorData.get(iso);
          return (
            <button
              key={iso}
              type="button"
              className={`agenda-semana-dia${iso === hoje ? " hoje" : ""}`}
              onClick={() => onIrParaDia(d)}
              title={feriado ? `Feriado: ${feriado}` : undefined}
            >
              <span>{ROTULO_DIA_CURTO[i]}</span>
              <strong>{d.getDate()}</strong>
              {feriado && <span className="agenda-semana-feriado">feriado</span>}
            </button>
          );
        })}
      </div>
      <div className="agenda-timeline-body" style={{ height: alturaGrade }}>
        <div className="agenda-timeline-horas">
          {horasDaGrade.map((h) => (
            <span
              key={h}
              className="agenda-timeline-hora-label"
              style={{ top: (h - horaInicioGrade) * 60 }}
            >
              {h}h
            </span>
          ))}
        </div>
        {horasDaGrade.map((h) => (
          <div key={h} className="agenda-timeline-linha" style={{ top: (h - horaInicioGrade) * 60 }} />
        ))}
        <div className="agenda-timeline-colunas">
          {datas.map((d) => {
            const iso = toISODate(d);
            const doDia = ocorrenciasPorDia.get(iso) ?? [];
            return (
              <div key={iso} className="agenda-timeline-coluna agenda-semana-coluna">
                {distribuirEmFaixas(doDia).map(({ oc, faixa, faixas }) => {
                  const top = minutosDoHorario(oc.horario) - horaInicioGrade * 60;
                  const pessoas = pessoasDaOcorrencia(oc);
                  const titulo = `${oc.categoriaNome} · ${oc.quadraNome} · ${oc.horario} – ${horarioFim(oc.horario, oc.duracaoMinutos)} · ${oc.professorNome}`;
                  return (
                    <button
                      key={`${oc.turmaId}-${iso}`}
                      type="button"
                      className={`agenda-timeline-bloco${oc.cancelada ? " cancelada" : ""}${chaveSelecionada === `${oc.turmaId}-${iso}` ? " selecionado" : ""}`}
                      title={oc.cancelada ? `${titulo} — cancelada` : titulo}
                      style={{
                        top,
                        height: Math.max(oc.duracaoMinutos, 34),
                        left: `calc(${(faixa / faixas) * 100}% + 2px)`,
                        right: "auto",
                        width: `calc(${100 / faixas}% - 4px)`,
                        background: oc.cancelada ? undefined : hexParaRgba(oc.categoriaCor, 0.2),
                        borderColor: oc.cancelada ? undefined : oc.categoriaCor,
                        color: oc.cancelada ? undefined : oc.categoriaCor,
                      }}
                      onClick={() => (oc.cancelada ? onIrParaDia(d) : onAbrir(oc))}
                    >
                      <span className="agenda-timeline-bloco-titulo">{oc.categoriaNome}</span>
                      <span className="agenda-timeline-bloco-sub">
                        {oc.cancelada ? "cancelada" : `${pessoas.length}/${oc.capacidade}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const MAX_CHIPS_POR_DIA = 3;

/** Visão de mês (pedido do usuário, 2026-09-21) — grade de calendário; cada
 * dia lista as aulas (hora + categoria + ocupação) e clicar abre o dia. */
function AgendaMes({
  referencia,
  ocorrenciasPorDia,
  feriadosPorData,
  pessoasDaOcorrencia,
  onIrParaDia,
}: {
  referencia: Date;
  ocorrenciasPorDia: Map<string, OcorrenciaTurma[]>;
  feriadosPorData: Map<string, string>;
  pessoasDaOcorrencia: (oc: OcorrenciaTurma) => Pessoa[];
  onIrParaDia: (d: Date) => void;
}) {
  const primeiro = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const ultimo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  const inicioGrade = inicioDaSemana(primeiro);
  const totalDias = Math.ceil(((ultimo.getTime() - inicioGrade.getTime()) / 86400000 + 1) / 7) * 7;
  const dias = Array.from({ length: totalDias }, (_, i) => somarDias(inicioGrade, i));
  const hoje = toISODate(new Date());

  return (
    <div className="agenda-mes">
      <div className="agenda-mes-cabecalho">
        {ROTULO_DIA_CURTO.map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <div className="agenda-mes-grade">
        {dias.map((d) => {
          const iso = toISODate(d);
          const doMes = d.getMonth() === referencia.getMonth();
          const feriado = feriadosPorData.get(iso);
          const todas = ocorrenciasPorDia.get(iso) ?? [];
          const ativas = doMes
            ? todas
                .filter((oc) => !oc.cancelada)
                .sort((a, b) => minutosDoHorario(a.horario) - minutosDoHorario(b.horario))
            : [];
          const canceladas = doMes ? todas.filter((oc) => oc.cancelada).length : 0;
          return (
            <button
              key={iso}
              type="button"
              className={`agenda-mes-dia${doMes ? "" : " fora"}${iso === hoje ? " hoje" : ""}`}
              onClick={() => onIrParaDia(d)}
            >
              <span className="agenda-mes-numero">
                {d.getDate()}
                {feriado && doMes && (
                  <span className="agenda-mes-feriado" title={`Feriado: ${feriado}`}>
                    ⚑
                  </span>
                )}
              </span>
              {ativas.slice(0, MAX_CHIPS_POR_DIA).map((oc) => (
                <span
                  key={oc.turmaId}
                  className="agenda-mes-chip"
                  style={{
                    background: hexParaRgba(oc.categoriaCor, 0.2),
                    color: oc.categoriaCor,
                    borderColor: oc.categoriaCor,
                  }}
                >
                  {oc.horario.slice(0, 2)}h {oc.categoriaNome} {pessoasDaOcorrencia(oc).length}/
                  {oc.capacidade}
                </span>
              ))}
              {ativas.length > MAX_CHIPS_POR_DIA && (
                <span className="agenda-mes-mais">+{ativas.length - MAX_CHIPS_POR_DIA}</span>
              )}
              {canceladas > 0 && <span className="agenda-mes-cancelada">{canceladas} cancelada(s)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Detalhe de uma ocorrência ao clicar no bloco da grade (pedido do
 * usuário, 2026-09-15: o bloco em si fica pequeno demais pra presença/
 * cancelamento). Painel ao lado da grade no layout do kit
 * (design/telas/Agenda.dc.html; pedido do usuário, 2026-10-01): inscritos,
 * presentes e vagas, a presença e o cancelamento. */
function DetalheOcorrencia({
  ocorrencia,
  pessoas,
  origemPorMatricula,
  onFechar,
  onCancelarTurma,
  onCancelarAluno,
}: {
  ocorrencia: OcorrenciaTurma;
  pessoas: Pessoa[];
  origemPorMatricula: Map<number, string>;
  onFechar: () => void;
  onCancelarTurma: (alunosCount: number) => void;
  onCancelarAluno: (matriculaId: number, nome: string) => void;
}) {
  const presenca = usePresenca(ocorrencia.turmaId, toISODate(ocorrencia.data));
  const vagas = Math.max(0, ocorrencia.capacidade - pessoas.length);
  const quando = ocorrencia.data
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="agenda-detalhe-corpo">
      <div className="agenda-detalhe-topo">
        <CategoriaBadge nome={ocorrencia.categoriaNome} cor={ocorrencia.categoriaCor} />
        <button type="button" className="agenda-detalhe-fechar" onClick={onFechar} aria-label="Fechar detalhe">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div>
        <h2 className="agenda-detalhe-titulo">{ocorrencia.modalidadeNome}</h2>
        <p className="alunos-sub">
          {quando} · {ocorrencia.horario} – {horarioFim(ocorrencia.horario, ocorrencia.duracaoMinutos)} ·{" "}
          {ocorrencia.quadraNome}
        </p>
        <p className="alunos-sub">com {ocorrencia.professorNome}</p>
      </div>
      <div className="agenda-detalhe-numeros">
        <div>
          <strong>{pessoas.length}</strong>
          <span>inscritos</span>
        </div>
        <div>
          <strong>{presenca.carregado ? presenca.presentes.size : "–"}</strong>
          <span>presentes</span>
        </div>
        <div>
          <strong>{vagas}</strong>
          <span>{vagas === 1 ? "vaga" : "vagas"}</span>
        </div>
      </div>

      <PresencaLista
        pessoas={pessoas}
        origemPorMatricula={origemPorMatricula}
        presenca={presenca}
        onCancelarAluno={onCancelarAluno}
      />

      <button type="button" className="secondary agenda-detalhe-cancelar" onClick={() => onCancelarTurma(pessoas.length)}>
        Cancelar aula
      </button>
    </div>
  );
}

function GerenciarAulaModal({
  ocorrencia,
  alunosCount,
  onFechar,
  onRemovido,
}: {
  ocorrencia: OcorrenciaTurma;
  alunosCount: number;
  onFechar: () => void;
  onRemovido: () => void;
}) {
  const { turmaId, data } = ocorrencia;
  const [enviando, setEnviando] = useState<"unica_data" | "a_partir_desta_data" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Check de crédito (pedido do usuário, 2026-08-28: "tem aluno agendado,
  // é natural gerar o crédito ... coloca um check pra confirmar") — só
  // aparece quando tem aluno na ocorrência, e vem marcado por padrão.
  const [gerarCredito, setGerarCredito] = useState(true);
  // Motivo do cancelamento (pedido do usuário, 2026-09-01: "o cancelar
  // aula do professor ou adm precisa dar um motivo, alguns motivos
  // padrões pode ser selecionado como: Chuva, ventos fortes ou outros
  // onde precisa informar o motivo") — obrigatório só pra "cancelar só
  // este dia" (é o que vira TurmaExcecao com motivo, ver backend); "em
  // diante" encerra a série, decisão diferente, sem motivo pra guardar.
  const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);
  const [motivoOutro, setMotivoOutro] = useState("");
  const usandoOutro = motivoSelecionado === "outro";
  const motivoFinal = (usandoOutro ? motivoOutro : motivoSelecionado)?.trim() || null;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const rotuloData = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function remover(escopo: "unica_data" | "a_partir_desta_data") {
    setEnviando(escopo);
    setErro(null);
    try {
      await api.post(`/turmas/${turmaId}/remocoes`, {
        escopo,
        data: toISODate(data),
        gerar_credito: alunosCount > 0 && gerarCredito,
        motivo: motivoFinal,
      });
      onRemovido();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível remover. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">{ocorrencia.modalidadeNome}</span>
          <span className="item-card-subtitle">
            {rotuloData} · {ocorrencia.horario} · {ocorrencia.quadraNome} · {ocorrencia.pointNome}
          </span>
        </div>

        <div>
          <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
            Motivo do cancelamento
          </span>
          <div className="toggle-grid">
            {["Chuva", "Ventos fortes"].map((m) => (
              <button
                key={m}
                type="button"
                className={motivoSelecionado === m ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setMotivoSelecionado(m)}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              className={usandoOutro ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setMotivoSelecionado("outro")}
            >
              Outro
            </button>
          </div>
          {usandoOutro && (
            <input
              style={{ marginTop: 8 }}
              placeholder="Descreva o motivo"
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
            />
          )}
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Obrigatório só pra cancelar um dia específico — "em diante" encerra a série toda.
          </p>
        </div>

        {alunosCount > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={gerarCredito}
              onChange={(e) => setGerarCredito(e.target.checked)}
            />
            Gerar crédito de reposição pra quem já tem aula marcada nessa data
          </label>
        )}

        {erro && <p className="form-error">{erro}</p>}

        <div className="modal-actions">
          <button
            disabled={enviando !== null || !motivoFinal}
            onClick={() => remover("unica_data")}
          >
            {enviando === "unica_data" ? "Cancelando..." : "Cancelar só este dia"}
          </button>
          <button
            className="secondary"
            disabled={enviando !== null}
            onClick={() => remover("a_partir_desta_data")}
          >
            {enviando === "a_partir_desta_data" ? "Cancelando..." : "Cancelar este dia em diante"}
          </button>
          <button className="secondary" disabled={enviando !== null} onClick={onFechar}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cancelar a aula de UM aluno específico dentro dessa ocorrência de
 * turma, pelo professor ou pelo admin (pedido do usuário, 2026-09-01: "o
 * professor pode cancelar uma aula de um determinado aluno de última
 * hora, precisa informar o motivo e opção de gerar crédito ou não") —
 * diferente do GerenciarAulaModal acima, que cancela a turma inteira
 * (todo mundo) nessa data; mesma API (POST .../cancelar-admin, agora
 * também aberta pra professor da turma), mesmo padrão de motivo em chips
 * já usado ali e no cancelamento por turma. */
function CancelarAulaAlunoModal({
  nomeAluno,
  matriculaId,
  ocorrencia,
  onFechar,
  onCancelado,
}: {
  nomeAluno: string;
  matriculaId: number;
  ocorrencia: OcorrenciaTurma;
  onFechar: () => void;
  onCancelado: () => void;
}) {
  const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);
  const [motivoOutro, setMotivoOutro] = useState("");
  const usandoOutro = motivoSelecionado === "outro";
  const motivoFinal = (usandoOutro ? motivoOutro : motivoSelecionado)?.trim() || null;
  const [gerarCredito, setGerarCredito] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const rotuloData = ocorrencia.data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function cancelar() {
    if (!motivoFinal) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/matriculas/${matriculaId}/aulas/${toISODate(ocorrencia.data)}/cancelar-admin`, {
        gerar_credito: gerarCredito,
        motivo: motivoFinal,
      });
      onCancelado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">Cancelar aula de {nomeAluno}</span>
          <span className="item-card-subtitle">
            {rotuloData} · {ocorrencia.horario} · {ocorrencia.modalidadeNome}
          </span>
        </div>

        <div style={{ marginTop: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
            Motivo do cancelamento
          </span>
          <div className="toggle-grid">
            {/* Motivos diferentes do cancelamento por turma acima (pedido
                do usuário, 2026-09-01: "os motivos de aluno são: doença,
                motivo pessoal, outros", depois "troque doença para
                saúde") — aqui é só ESSE aluno, então o motivo é dele, não
                do tempo. */}
            {["Saúde", "Motivo pessoal"].map((m) => (
              <button
                key={m}
                type="button"
                className={motivoSelecionado === m ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setMotivoSelecionado(m)}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              className={usandoOutro ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setMotivoSelecionado("outro")}
            >
              Outro
            </button>
          </div>
          {usandoOutro && (
            <input
              style={{ marginTop: 8 }}
              placeholder="Descreva o motivo"
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
            />
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={gerarCredito}
            onChange={(e) => setGerarCredito(e.target.checked)}
            style={{ width: "auto" }}
          />
          Gerar crédito de reposição pro aluno
        </label>

        {erro && <p className="form-error">{erro}</p>}

        <div className="modal-actions">
          <button disabled={enviando || !motivoFinal} onClick={cancelar}>
            {enviando ? "Cancelando..." : "Cancelar esta aula"}
          </button>
          <button className="secondary" disabled={enviando} onClick={onFechar}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
