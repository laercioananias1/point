import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Checkin, Matricula, TurmaResumo } from "../api/types";
import { Icon } from "./Layout";
import { diaSemanaDeData, toISODate } from "./Calendar";
import { MiniCalendario } from "./MiniCalendario";
import { horarioFim } from "../lib/dias";

interface OcorrenciaTurma {
  turmaId: number;
  data: Date;
  horario: string;
  duracaoMinutos: number;
  modalidadeNome: string;
  pointNome: string;
  quadraNome: string;
  professorNome: string;
  capacidade: number;
}

/** Ocorrências de todas as turmas passadas dentro das datas visíveis —
 * mesma ideia de app.services.aulas (dia_semana × período), só que
 * calculado no cliente pra alimentar os pontinhos do calendário. */
function ocorrenciasEmDatas(turmas: TurmaResumo[], datas: Date[]): Map<string, OcorrenciaTurma[]> {
  const mapa = new Map<string, OcorrenciaTurma[]>();
  const adicionar = (iso: string, oc: OcorrenciaTurma) => {
    const lista = mapa.get(iso);
    if (lista) lista.push(oc);
    else mapa.set(iso, [oc]);
  };

  for (const t of turmas) {
    for (const data of datas) {
      const iso = toISODate(data);
      if (iso < t.periodo_inicio) continue;
      if (t.periodo_fim !== null && iso > t.periodo_fim) continue;
      if (t.excecoes.includes(iso)) continue;
      if (!t.dias_semana.includes(diaSemanaDeData(data))) continue;
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
      });
    }
  }
  return mapa;
}

/** Essa matrícula tem mesmo aula nessa turma nessa data — espelha
 * app.services.aulas::matricula_tem_aula_em (pedido do usuário,
 * 2026-08-26: "mostrar também os alunos e um check pra marcar presença de
 * cada um" — o backend valida de novo, isso só decide quem aparece na
 * lista). */
function matriculaTemAulaEm(m: Matricula, turmaId: number, iso: string, diaSemana: string): boolean {
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
  onMudanca,
}: {
  turmas: TurmaResumo[];
  matriculas: Matricula[];
  onMudanca: () => void;
}) {
  const [removendo, setRemovendo] = useState<{ ocorrencia: OcorrenciaTurma; alunosCount: number } | null>(
    null,
  );
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [diasVisiveis, setDiasVisiveis] = useState<Date[]>([]);
  const onDiasVisiveisChange = useCallback((dias: Date[]) => setDiasVisiveis(dias), []);

  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(turmas, diasVisiveis),
    [turmas, diasVisiveis],
  );
  const ocorrenciasDoDia = ocorrenciasPorDia.get(toISODate(diaSelecionado)) ?? [];

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
          {ocorrenciasDoDia.map((oc, i) => {
            const iso = toISODate(oc.data);
            const diaSemana = diaSemanaDeData(oc.data);
            const alunos = matriculas
              .filter((m) => matriculaTemAulaEm(m, oc.turmaId, iso, diaSemana))
              .map((m) => ({ matriculaId: m.id, nome: m.aluno.nome }));
            return (
              <div
                key={i}
                className="item-card"
                style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div className="item-card-info">
                    <span className="item-card-title">
                      {oc.horario} – {horarioFim(oc.horario, oc.duracaoMinutos)}
                    </span>
                    <span className="item-card-subtitle">
                      {oc.modalidadeNome} · com {oc.professorNome}
                    </span>
                    <span
                      className="item-card-subtitle"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="pin" /> {oc.pointNome} · {oc.quadraNome}
                    </span>
                    <span
                      className="item-card-subtitle"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="users" /> {alunos.length}/{oc.capacidade} vaga(s)
                    </span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setRemovendo({ ocorrencia: oc, alunosCount: alunos.length })}
                  >
                    Cancelar aula
                  </button>
                </div>

                <PresencaLista turmaId={oc.turmaId} data={oc.data} alunos={alunos} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Checklist de presença dos alunos esperados nessa ocorrência (pedido do
 * usuário, 2026-08-26: "mostrar também os alunos e um check pra marcar
 * presença de cada um"). Cada check é um Checkin de origem "presumido" —
 * o backend confere de novo se esse aluno realmente tem aula nessa data
 * antes de marcar. */
function PresencaLista({
  turmaId,
  data,
  alunos,
}: {
  turmaId: number;
  data: Date;
  alunos: { matriculaId: number; nome: string }[];
}) {
  const iso = toISODate(data);
  const [presentes, setPresentes] = useState<Set<number>>(new Set());
  const [carregado, setCarregado] = useState(false);
  const [alterando, setAlterando] = useState<number | null>(null);

  useEffect(() => {
    setCarregado(false);
    api
      .get<Checkin[]>(`/checkins/turma/${turmaId}?data=${iso}`)
      .then((checkins) => {
        setPresentes(
          new Set(checkins.filter((c) => c.matricula_id !== null).map((c) => c.matricula_id as number)),
        );
      })
      .finally(() => setCarregado(true));
  }, [turmaId, iso]);

  async function alternar(matriculaId: number) {
    setAlterando(matriculaId);
    try {
      if (presentes.has(matriculaId)) {
        await api.delete(`/checkins/presenca?turma_id=${turmaId}&matricula_id=${matriculaId}&data=${iso}`);
        setPresentes((atual) => {
          const proximo = new Set(atual);
          proximo.delete(matriculaId);
          return proximo;
        });
      } else {
        await api.post("/checkins/presenca", { turma_id: turmaId, matricula_id: matriculaId, data: iso });
        setPresentes((atual) => new Set(atual).add(matriculaId));
      }
    } finally {
      setAlterando(null);
    }
  }

  if (alunos.length === 0) {
    return (
      <p className="empty-state" style={{ margin: 0, padding: 0 }}>
        Nenhum aluno matriculado nessa aula.
      </p>
    );
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--line)",
        paddingTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span className="item-card-subtitle" style={{ fontWeight: 600 }}>
        Presença {carregado && `(${presentes.size}/${alunos.length})`}
      </span>
      {alunos.map((a) => (
        <label
          key={a.matriculaId}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={presentes.has(a.matriculaId)}
            disabled={!carregado || alterando === a.matriculaId}
            onChange={() => alternar(a.matriculaId)}
          />
          {a.nome}
        </label>
      ))}
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
          <button disabled={enviando !== null} onClick={() => remover("unica_data")}>
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
            Desistir
          </button>
        </div>
      </div>
    </div>
  );
}
