import { useEffect, useMemo, useState } from "react";
import type { Feriado, Matricula } from "../api/types";
import {
  AgendaDiaNav,
  datasDoPeriodo,
  MAX_CHIPS_POR_DIA,
  ROTULO_DIA_CURTO,
  type Granularidade,
} from "./AgendaTurmasCalendario";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";
import { buscarFeriadosPorPoint } from "../lib/feriados";
import { horarioFim } from "../lib/dias";
import { Icon } from "./Layout";

export interface Ocorrencia {
  matriculaId: number;
  data: Date;
  tipo: "mensal" | "avulsa";
  // Avulsa que nasceu de um crédito reagendado, não de compra direta
  // (pedido do usuário, 2026-09-01, com referência visual de ícones:
  // "dá pra implementar esses ícones" — Aula Avulsa vs Aula de
  // Reposição). Sempre false quando tipo === "mensal".
  eReposicao: boolean;
  horario: string;
  duracaoMinutos: number;
  modalidadeNome: string;
  pointNome: string;
  quadraNome: string;
  professorNome: string;
  capacidade: number;
  prazoCancelamentoHoras: number;
}

/** Ocorrências de todas as matrículas ativas dentro das datas visíveis
 * (pedido do usuário, 2026-08-26) — mensal expande dias_semana × período
 * (igual ao Calendar.tsx genérico); avulsa é só a data única
 * (data_inicio_efetiva, que agora é a data real escolhida na compra, não
 * mais o início da turma). */
function ocorrenciasEmDatas(
  matriculas: Matricula[],
  datas: Date[],
  feriadosPorPoint: Record<number, Feriado[]>,
): Map<string, Ocorrencia[]> {
  const mapa = new Map<string, Ocorrencia[]>();
  const isos = new Set(datas.map(toISODate));

  const adicionar = (iso: string, oc: Ocorrencia) => {
    const lista = mapa.get(iso);
    if (lista) lista.push(oc);
    else mapa.set(iso, [oc]);
  };

  for (const m of matriculas) {
    if (m.status !== "ativa") continue;
    const base = {
      matriculaId: m.id,
      eReposicao: m.e_reposicao,
      horario: m.turma.horario,
      duracaoMinutos: m.turma.duracao_minutos,
      modalidadeNome: m.turma.modalidade.nome,
      pointNome: m.turma.vinculo.point.nome,
      quadraNome: m.turma.quadra.nome,
      professorNome: m.turma.vinculo.professor.nome,
      capacidade: m.turma.capacidade,
      prazoCancelamentoHoras: m.turma.vinculo.point.prazo_cancelamento_horas,
    };

    if (m.tipo === "mensal") {
      // Feriado (pedido do usuário, 2026-09-01: "o sistema... não pode
      // criar [aula] nesses dias de feriados") — o backend nunca gera
      // essa Aula (gerar_aulas_do_mes), então nem mostra aqui: sem ícone
      // de cancelamento nessa agenda (diferente da agenda por turma), só
      // some como uma exceção normal, mesmo tratamento que já dava pras
      // datas removidas por força maior.
      const feriados = (feriadosPorPoint[m.turma.vinculo.point_id] ?? []).map((f) => f.data);
      const excluidas = new Set([...m.turma.excecoes, ...m.excecoes, ...feriados]);
      for (const data of datas) {
        const iso = toISODate(data);
        if (iso < m.data_inicio_efetiva) continue;
        if (m.turma.periodo_fim !== null && iso > m.turma.periodo_fim) continue;
        if (excluidas.has(iso)) continue;
        if (!m.dias_semana.includes(diaSemanaDeData(data))) continue;
        adicionar(iso, { ...base, data, tipo: "mensal" });
      }
    } else if (isos.has(m.data_inicio_efetiva)) {
      adicionar(m.data_inicio_efetiva, {
        ...base,
        data: new Date(`${m.data_inicio_efetiva}T00:00`),
        tipo: "avulsa",
      });
    }
  }
  return mapa;
}

/** Agenda do aluno (pedido do usuário, 2026-08-26: "a agenda do aluno pode
 * ser diferente, pq é algo individual só dele" — sem grade hora-a-hora).
 * Depois, 2026-10-01: "não dá pra deixar a agenda do aluno igual do
 * professor?" — mesma navegação da agenda do admin/professor (faixa de
 * dias, Dia/Semana/Mês, components/AgendaTurmasCalendario), mas as aulas
 * do aluno em cards: um dia, a semana agrupada por dia, ou o mês em grade.
 * Também usado pelo admin ajustando a agenda de um aluno (paraAdmin). */
export function AgendaAlunoCalendario({
  matriculas,
  onCancelar,
  paraAdmin = false,
}: {
  matriculas: Matricula[];
  onCancelar: (ocorrencia: Ocorrencia) => void;
  // Admin ajustando a agenda de um aluno (pedido do usuário, 2026-09-01) —
  // ignora o prazo mínimo de cancelamento, então o aviso não deve
  // mencionar prazo nenhum (ver admin-point/AgendaAluno.tsx).
  paraAdmin?: boolean;
}) {
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [passo, setPasso] = useState<Granularidade>("dia");

  // Feriados (pedido do usuário, 2026-09-01) — busca própria, por
  // point_id (o aluno pode ter matrícula em mais de um Point).
  const pointIds = useMemo(
    () => Array.from(new Set(matriculas.map((m) => m.turma.vinculo.point_id))),
    [matriculas],
  );
  const [feriadosPorPoint, setFeriadosPorPoint] = useState<Record<number, Feriado[]>>({});
  useEffect(() => {
    if (pointIds.length === 0) return;
    buscarFeriadosPorPoint(pointIds).then(setFeriadosPorPoint);
  }, [pointIds]);

  // Mapa data→nome, independente de ter aula ou não nesse dia (pedido do
  // usuário, 2026-09-01: um feriado num dia da semana que esse aluno nem
  // tem aula precisa aparecer do mesmo jeito).
  const feriadosPorData = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const id of pointIds) {
      for (const f of feriadosPorPoint[id] ?? []) mapa.set(f.data, f.nome);
    }
    return mapa;
  }, [pointIds, feriadosPorPoint]);

  // No Dia a faixa mostra a semana inteira (com o pontinho de "tem aula"),
  // então calcula a semana; no Mês, a grade do mês inteiro (com as pontas
  // das semanas vizinhas).
  const datasCalculadas = useMemo(() => {
    if (passo !== "mes") return datasDoPeriodo(diaSelecionado, "semana");
    const primeiro = new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth(), 1);
    const ultimo = new Date(diaSelecionado.getFullYear(), diaSelecionado.getMonth() + 1, 0);
    const inicio = inicioDaSemana(primeiro);
    const total = Math.ceil(((ultimo.getTime() - inicio.getTime()) / 86400000 + 1) / 7) * 7;
    return Array.from({ length: total }, (_, i) => somarDias(inicio, i));
  }, [diaSelecionado, passo]);

  const ocorrenciasPorDia = useMemo(() => {
    const mapa = ocorrenciasEmDatas(matriculas, datasCalculadas, feriadosPorPoint);
    for (const lista of mapa.values()) lista.sort((a, b) => a.horario.localeCompare(b.horario));
    return mapa;
  }, [matriculas, datasCalculadas, feriadosPorPoint]);

  const datasDoPasso = datasDoPeriodo(diaSelecionado, passo);
  const aulasNoPeriodo = datasDoPasso.reduce(
    (total, d) => total + (ocorrenciasPorDia.get(toISODate(d))?.length ?? 0),
    0,
  );
  const isoSelecionado = toISODate(diaSelecionado);
  const ocorrenciasDoDia = ocorrenciasPorDia.get(isoSelecionado) ?? [];
  const nomeFeriadoDoDia = feriadosPorData.get(isoSelecionado) ?? null;

  function irParaDia(d: Date) {
    setDiaSelecionado(d);
    setPasso("dia");
  }

  const cartoes = (lista: Ocorrencia[]) =>
    lista.map((oc, i) => (
      <AulaDoAluno key={`${oc.matriculaId}-${i}`} ocorrencia={oc} paraAdmin={paraAdmin} onCancelar={onCancelar} />
    ));

  return (
    <>
      <AgendaDiaNav
        diaSelecionado={diaSelecionado}
        onSelecionarDia={setDiaSelecionado}
        passo={passo}
        onMudarPasso={setPasso}
        diasComAula={(d) => (ocorrenciasPorDia.get(toISODate(d))?.length ?? 0) > 0}
        resumo={
          <span>
            <strong>{aulasNoPeriodo}</strong> {aulasNoPeriodo === 1 ? "aula" : "aulas"}
          </span>
        }
      />

      {passo === "dia" && (
        <>
          {nomeFeriadoDoDia && (
            <p className="agenda-feriado">
              <Icon name="flag" size={16} /> Feriado: {nomeFeriadoDoDia}
            </p>
          )}
          {ocorrenciasDoDia.length === 0 ? (
            <p className="alunos-card alunos-vazio">
              {nomeFeriadoDoDia ? "Feriado — sem aulas nesse dia." : "Nenhuma aula nesse dia."}
            </p>
          ) : (
            <div className="agenda-aluno-aulas">{cartoes(ocorrenciasDoDia)}</div>
          )}
        </>
      )}

      {passo === "semana" &&
        (aulasNoPeriodo === 0 ? (
          <p className="alunos-card alunos-vazio">Nenhuma aula nessa semana.</p>
        ) : (
          <div className="agenda-aluno-semana">
            {datasDoPasso.map((d) => {
              const iso = toISODate(d);
              const doDia = ocorrenciasPorDia.get(iso) ?? [];
              const feriado = feriadosPorData.get(iso);
              if (doDia.length === 0 && !feriado) return null;
              return (
                <section key={iso} className="agenda-aluno-grupo">
                  <button type="button" className="agenda-aluno-grupo-titulo" onClick={() => irParaDia(d)}>
                    {d
                      .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })
                      .replace(/^\w/, (c) => c.toUpperCase())}
                    {iso === toISODate(new Date()) && <span className="status-pill status-good">Hoje</span>}
                    {feriado && <span className="agenda-aluno-feriado">Feriado: {feriado}</span>}
                  </button>
                  {cartoes(doDia)}
                </section>
              );
            })}
          </div>
        ))}

      {passo === "mes" && (
        <section className="alunos-card agenda-grade-card">
          <div className="agenda-mes">
            <div className="agenda-mes-cabecalho">
              {ROTULO_DIA_CURTO.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
            <div className="agenda-mes-grade">
              {datasCalculadas.map((d) => {
                const iso = toISODate(d);
                const doMes = d.getMonth() === diaSelecionado.getMonth();
                const feriado = feriadosPorData.get(iso);
                const doDia = doMes ? ocorrenciasPorDia.get(iso) ?? [] : [];
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`agenda-mes-dia${doMes ? "" : " fora"}${iso === toISODate(new Date()) ? " hoje" : ""}`}
                    onClick={() => irParaDia(d)}
                  >
                    <span className="agenda-mes-numero">
                      {d.getDate()}
                      {feriado && doMes && (
                        <span className="agenda-mes-feriado" title={`Feriado: ${feriado}`}>
                          ⚑
                        </span>
                      )}
                    </span>
                    {doDia.slice(0, MAX_CHIPS_POR_DIA).map((oc, i) => (
                      <span key={i} className={`agenda-mes-chip agenda-aluno-chip ${tipoDaOcorrencia(oc)}`}>
                        {oc.horario.slice(0, 2)}h {oc.modalidadeNome}
                      </span>
                    ))}
                    {doDia.length > MAX_CHIPS_POR_DIA && (
                      <span className="agenda-mes-mais">+{doDia.length - MAX_CHIPS_POR_DIA}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function tipoDaOcorrencia(oc: Ocorrencia): "mensal" | "reposicao" | "avulsa" {
  return oc.tipo === "mensal" ? "mensal" : oc.eReposicao ? "reposicao" : "avulsa";
}

const ROTULO_TIPO = { mensal: "Recorrente", reposicao: "Reposição", avulsa: "Avulsa" };

/** Uma aula do aluno: horário, turma, professor/quadra e o tipo; aula
 * recorrente tem o botão de cancelar com antecedência (gera crédito). */
function AulaDoAluno({
  ocorrencia: oc,
  paraAdmin,
  onCancelar,
}: {
  ocorrencia: Ocorrencia;
  paraAdmin: boolean;
  onCancelar: (ocorrencia: Ocorrencia) => void;
}) {
  const tipo = tipoDaOcorrencia(oc);
  return (
    <div className="agenda-aluno-aula">
      <div className="agenda-aluno-aula-linha">
        <span className="prof-aula-hora">
          <span className="prof-aula-horario">{oc.horario}</span>
          <span className="alunos-sub">{oc.duracaoMinutos} min</span>
        </span>
        <span className="prof-aula-info">
          <span className="alunos-nome">{oc.modalidadeNome}</span>
          <span className="alunos-sub">
            com {oc.professorNome} · {oc.quadraNome} · {oc.pointNome}
          </span>
          <span className="alunos-sub">
            Até {horarioFim(oc.horario, oc.duracaoMinutos)} · {oc.capacidade} vaga(s) na turma
          </span>
        </span>
        <span className={`agenda-aluno-tipo ${tipo}`}>{ROTULO_TIPO[tipo]}</span>
      </div>
      {oc.tipo === "mensal" && (
        <div className="agenda-aluno-cancelar">
          <span className="alunos-sub">
            {paraAdmin
              ? "Cancelar essa aula do aluno (crédito é opcional)."
              : `Cancelando com pelo menos ${oc.prazoCancelamentoHoras}h de antecedência você ganha um crédito de reposição.`}
          </span>
          <button type="button" className="secondary" onClick={() => onCancelar(oc)}>
            Cancelar aula
          </button>
        </div>
      )}
    </div>
  );
}
