import { useCallback, useEffect, useMemo, useState } from "react";
import type { Feriado, Matricula } from "../api/types";
import { diaSemanaDeData, toISODate } from "./Calendar";
import { buscarFeriadosPorPoint } from "../lib/feriados";
import { horarioFim } from "../lib/dias";
import { Icon } from "./Layout";
import { MiniCalendario, type MarcadorDia } from "./MiniCalendario";

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

/** Calendário próprio da agenda do aluno (pedido do usuário, 2026-08-26:
 * "a agenda do aluno pode ser diferente, pq é algo individual só dele" —
 * referência de app de academia: visão mês/semana com um pontinho por dia
 * com aula, sem grade hora-a-hora, e o dia selecionado detalhado embaixo).
 * Usa a grade compartilhada (MiniCalendario) + sua própria lista de
 * ocorrências (com crédito/cancelamento, que só faz sentido pro aluno). */
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
  const [diasVisiveis, setDiasVisiveis] = useState<Date[]>([]);
  const onDiasVisiveisChange = useCallback((dias: Date[]) => setDiasVisiveis(dias), []);

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
  // usuário, 2026-09-01, depois de reparar que 25/12 não tinha ícone: "o
  // sistema... não pode criar [aula] nesses dias de feriados" não pode
  // depender de já existir uma ocorrência pra aparecer — um feriado num
  // dia da semana que esse aluno nem tem aula precisa aparecer do mesmo
  // jeito).
  const feriadosPorData = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const id of pointIds) {
      for (const f of feriadosPorPoint[id] ?? []) mapa.set(f.data, f.nome);
    }
    return mapa;
  }, [pointIds, feriadosPorPoint]);

  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(matriculas, diasVisiveis, feriadosPorPoint),
    [matriculas, diasVisiveis, feriadosPorPoint],
  );

  const ocorrenciasDoDia = ocorrenciasPorDia.get(toISODate(diaSelecionado)) ?? [];
  const nomeFeriadoDoDia = feriadosPorData.get(toISODate(diaSelecionado)) ?? null;

  // Prioriza o caso mais fora do padrão quando o dia tem mais de um
  // (raro, mas possível): feriado > reposição > avulsa comprada >
  // recorrente normal.
  function marcadorDoDia(data: Date): MarcadorDia {
    const iso = toISODate(data);
    if (feriadosPorData.has(iso)) return "feriado";
    const ocs = ocorrenciasPorDia.get(iso);
    if (!ocs || ocs.length === 0) return null;
    if (ocs.some((oc) => oc.tipo === "avulsa" && oc.eReposicao)) return "reposicao";
    if (ocs.some((oc) => oc.tipo === "avulsa")) return "avulsa";
    return "mensal";
  }

  return (
    <div>
      <MiniCalendario
        marcadorDoDia={marcadorDoDia}
        diaSelecionado={diaSelecionado}
        onSelecionarDia={setDiaSelecionado}
        onDiasVisiveisChange={onDiasVisiveisChange}
      />

      {/* Legenda dos ícones do calendário (pedido do usuário, 2026-09-01:
          "deixa uma legenda em algum canto"). */}
      <div className="mini-calendar-legenda">
        <span style={{ color: "var(--accent)" }}>
          <Icon name="calendar" size={12} /> Recorrente/mensal
        </span>
        <span style={{ color: "var(--coral)" }}>
          <Icon name="ticket" size={12} /> Avulsa
        </span>
        <span style={{ color: "var(--warn)" }}>
          <Icon name="refresh" size={12} /> Reposição
        </span>
        <span style={{ color: "var(--good)" }}>
          <Icon name="flag" size={12} /> Feriado
        </span>
      </div>

      {nomeFeriadoDoDia && (
        <div className="item-card" style={{ marginBottom: 8 }}>
          <div className="item-card-info">
            <span
              className="item-card-title"
              style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--good)" }}
            >
              <Icon name="flag" /> Feriado: {nomeFeriadoDoDia}
            </span>
          </div>
        </div>
      )}

      {ocorrenciasDoDia.length === 0 ? (
        !nomeFeriadoDoDia && <p className="empty-state">Nenhuma aula nesse dia.</p>
      ) : (
        <div className="card-list">
          {ocorrenciasDoDia.map((oc, i) => (
            <div
              key={i}
              className={oc.tipo === "mensal" ? "item-card item-card-clickable" : "item-card"}
              role={oc.tipo === "mensal" ? "button" : undefined}
              tabIndex={oc.tipo === "mensal" ? 0 : undefined}
              onClick={oc.tipo === "mensal" ? () => onCancelar(oc) : undefined}
              onKeyDown={
                oc.tipo === "mensal"
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onCancelar(oc);
                    }
                  : undefined
              }
              style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span className="item-card-title">
                  {oc.horario} – {horarioFim(oc.horario, oc.duracaoMinutos)}
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <span className="status-pill status-info">
                    {oc.tipo === "mensal" ? "Recorrente" : oc.eReposicao ? "Reposição" : "Avulsa"}
                  </span>
                  <span className="status-pill status-good">Confirmada</span>
                </span>
              </div>
              <span className="item-card-subtitle">{oc.modalidadeNome}</span>
              <span className="item-card-subtitle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="pin" /> {oc.pointNome} · {oc.quadraNome}
              </span>
              <span className="item-card-subtitle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="user" /> {oc.professorNome}
              </span>
              <span className="item-card-subtitle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="users" /> {oc.capacidade} vaga(s) nessa turma
              </span>
              {oc.tipo === "mensal" && (
                <div className="info-box">
                  <span>
                    {paraAdmin
                      ? "Toque aqui pra cancelar essa aula do aluno (crédito é opcional)."
                      : `Precisa de pelo menos ${oc.prazoCancelamentoHoras}h de antecedência pra cancelar — toque aqui pra cancelar e ganhar crédito de reposição.`}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
