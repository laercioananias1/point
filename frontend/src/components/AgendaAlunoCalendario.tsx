import { useMemo, useState, useCallback } from "react";
import type { Matricula } from "../api/types";
import { diaSemanaDeData, toISODate } from "./Calendar";
import { horarioFim } from "../lib/dias";
import { Icon } from "./Layout";
import { MiniCalendario } from "./MiniCalendario";

export interface Ocorrencia {
  matriculaId: number;
  data: Date;
  tipo: "mensal" | "avulsa";
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
function ocorrenciasEmDatas(matriculas: Matricula[], datas: Date[]): Map<string, Ocorrencia[]> {
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
      const excluidas = new Set([...m.turma.excecoes, ...m.excecoes]);
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

  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(matriculas, diasVisiveis),
    [matriculas, diasVisiveis],
  );

  const ocorrenciasDoDia = ocorrenciasPorDia.get(toISODate(diaSelecionado)) ?? [];

  return (
    <div>
      <MiniCalendario
        temOcorrencia={(data) => (ocorrenciasPorDia.get(toISODate(data))?.length ?? 0) > 0}
        diaSelecionado={diaSelecionado}
        onSelecionarDia={setDiaSelecionado}
        onDiasVisiveisChange={onDiasVisiveisChange}
      />

      {ocorrenciasDoDia.length === 0 ? (
        <p className="empty-state">Nenhuma aula nesse dia.</p>
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
                    {oc.tipo === "mensal" ? "Recorrente" : "Avulsa"}
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
