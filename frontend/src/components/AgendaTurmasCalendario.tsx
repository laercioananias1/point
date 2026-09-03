import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Checkin, Feriado, Matricula, TurmaResumo } from "../api/types";
import { Icon } from "./Layout";
import { diaSemanaDeData, toISODate } from "./Calendar";
import { MiniCalendario } from "./MiniCalendario";
import { horarioFim } from "../lib/dias";
import { buscarFeriadosPorPoint } from "../lib/feriados";

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
function feriadosNoMapa(
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
function ocorrenciasEmDatas(
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
        cancelada,
        motivoCancelamento,
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
  // Cancelar a aula de UM aluno específico (pedido do usuário,
  // 2026-09-01: "o professor pode cancelar uma aula de um determinado
  // aluno de última hora") — diferente de `removendo`, que cancela a
  // turma inteira nessa data.
  const [cancelandoAluno, setCancelandoAluno] = useState<{
    matriculaId: number;
    nome: string;
    ocorrencia: OcorrenciaTurma;
  } | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [diasVisiveis, setDiasVisiveis] = useState<Date[]>([]);
  const onDiasVisiveisChange = useCallback((dias: Date[]) => setDiasVisiveis(dias), []);

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
  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(turmas, diasVisiveis, feriadosPorData),
    [turmas, diasVisiveis, feriadosPorData],
  );
  const ocorrenciasDoDia = ocorrenciasPorDia.get(toISODate(diaSelecionado)) ?? [];
  const nomeFeriadoDoDia = feriadosPorData.get(toISODate(diaSelecionado)) ?? null;

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

      <MiniCalendario
        // Aqui é por turma, não por matrícula — não tem a distinção
        // mensal/avulsa que a agenda do aluno tem (ver
        // AgendaAlunoCalendario.tsx). "feriado" e "cancelada" têm
        // prioridade sobre o pontinho genérico — são os casos fora do
        // padrão, o que mais vale destacar no mês; ícone de feriado é
        // separado do de cancelamento de propósito (pedido do usuário,
        // 2026-09-01: "não vamos misturar com dia que tem aula
        // cancelada").
        marcadorDoDia={(data) => {
          const iso = toISODate(data);
          // Feriado é incondicional (pedido do usuário, 2026-09-01: "por
          // que 25 dezembro não tem nenhum ícone?" — nenhuma turma tinha
          // aula numa sexta, então o feriado não aparecia) — marca o dia
          // mesmo sem nenhuma turma rodando nele.
          if (feriadosPorData.has(iso)) return "feriado";
          const ocs = ocorrenciasPorDia.get(iso);
          if (!ocs || ocs.length === 0) return null;
          return ocs.some((oc) => oc.cancelada) ? "cancelada" : "aula";
        }}
        diaSelecionado={diaSelecionado}
        onSelecionarDia={setDiaSelecionado}
        onDiasVisiveisChange={onDiasVisiveisChange}
      />

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
          {ocorrenciasDoDia.map((oc, i) => {
            if (oc.cancelada) {
              return (
                <div
                  key={i}
                  className="item-card"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
                >
                  <div className="item-card-info">
                    <span
                      className="item-card-title"
                      style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--risk)" }}
                    >
                      <Icon name="x-circle" /> {oc.horario} – {horarioFim(oc.horario, oc.duracaoMinutos)}{" "}
                      cancelada
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
                  </div>
                  {oc.motivoCancelamento && (
                    <div className="info-box" style={{ borderColor: "var(--risk)" }}>
                      <span>Motivo: {oc.motivoCancelamento}</span>
                    </div>
                  )}
                </div>
              );
            }

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

                <PresencaLista
                  turmaId={oc.turmaId}
                  data={oc.data}
                  alunos={alunos}
                  onCancelarAluno={(matriculaId, nome) =>
                    setCancelandoAluno({ matriculaId, nome, ocorrencia: oc })
                  }
                />
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
  onCancelarAluno,
}: {
  turmaId: number;
  data: Date;
  alunos: { matriculaId: number; nome: string }[];
  // Cancelar a aula de UM aluno específico, não a turma inteira (pedido
  // do usuário, 2026-09-01: "o professor pode cancelar uma aula de um
  // determinado aluno de última hora, precisa informar o motivo e opção
  // de gerar crédito ou não").
  onCancelarAluno: (matriculaId: number, nome: string) => void;
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
        <div
          key={a.matriculaId}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={presentes.has(a.matriculaId)}
              disabled={!carregado || alterando === a.matriculaId}
              onChange={() => alternar(a.matriculaId)}
            />
            {a.nome}
          </label>
          <button
            type="button"
            className="link-btn"
            style={{ padding: 0, fontSize: 12.5 }}
            onClick={() => onCancelarAluno(a.matriculaId, a.nome)}
          >
            Cancelar aula dele
          </button>
        </div>
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
            Desistir
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
        <p className="empty-state" style={{ padding: 0 }}>
          Desmarque se for só correção de um cadastro errado — nesse caso o aluno não perdeu uma aula
          de verdade.
        </p>

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
