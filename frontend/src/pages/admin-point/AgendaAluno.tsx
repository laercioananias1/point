import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Credito, Matricula, TurmaResumo } from "../../api/types";
import { diaSemanaDeData, somarDias, toISODate } from "../../components/Calendar";
import { AgendaAlunoCalendario, type Ocorrencia } from "../../components/AgendaAlunoCalendario";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA, horarioFim } from "../../lib/dias";

const DIAS_NA_TIRA = 21;

/** Agenda de um aluno específico, do lado do admin (pedido do usuário,
 * 2026-09-01: "preciso na tela de aluno do adm permitir editar as aulas,
 * remover... fazer ajustes na agenda do aluno") — normalmente usado quando
 * o aluno liga ou aparece pedindo pra resolver algo. Mesmo calendário que
 * o aluno usa pra si mesmo (AgendaAlunoCalendario), só que:
 * - ignora o prazo mínimo de cancelamento do Point (o admin está
 *   resolvendo uma exceção, não é autoatendimento);
 * - o crédito ao cancelar é opcional (checkbox) — às vezes o cadastro da
 *   aula estava errado e o admin vai criar um novo, não é uma aula de
 *   verdade perdida;
 * - também lista os créditos do aluno com a opção de reagendar por ele. */
export default function AdminPointAgendaAluno() {
  const { alunoId } = useParams<{ alunoId: string }>();
  const navigate = useNavigate();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Ocorrencia | null>(null);
  const [reagendandoCredito, setReagendandoCredito] = useState<Credito | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, creditosRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Credito[]>("/matriculas/creditos"),
      ]);
      setMatriculas(matriculasRes);
      setCreditos(creditosRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar a agenda desse aluno. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idAluno = Number(alunoId);
  const matriculasDoAluno = matriculas.filter((m) => m.aluno.id === idAluno);
  const ativas = matriculasDoAluno.filter((m) => m.status === "ativa");
  const idsMatriculasDoAluno = new Set(matriculasDoAluno.map((m) => m.id));
  const creditosDoAluno = creditos.filter((c) => idsMatriculasDoAluno.has(c.matricula_id));
  const creditosDisponiveis = creditosDoAluno.filter((c) => c.status === "disponivel");
  const nomeAluno = matriculasDoAluno[0]?.aluno.nome ?? "";

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/aluno")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Agenda {nomeAluno && `— ${nomeAluno}`}</h1>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {cancelando && (
        <CancelarAulaModalAdmin
          ocorrencia={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelado={() => {
            setCancelando(null);
            carregar();
          }}
        />
      )}

      {reagendandoCredito && (
        <ReagendarCreditoModalAdmin
          credito={reagendandoCredito}
          onFechar={() => setReagendandoCredito(null)}
          onReagendado={() => {
            setReagendandoCredito(null);
            carregar();
          }}
        />
      )}

      {pronto && (
        <>
          <section className="section">
            <h2>Calendário</h2>
            {ativas.length === 0 ? (
              <p className="empty-state">Esse aluno não tem matrícula mensal ativa.</p>
            ) : (
              <AgendaAlunoCalendario matriculas={ativas} onCancelar={setCancelando} paraAdmin />
            )}
          </section>

          <section className="section">
            <h2>Créditos disponíveis ({creditosDisponiveis.length})</h2>
            {creditosDisponiveis.length === 0 ? (
              <p className="empty-state">Nenhum crédito disponível pra esse aluno no momento.</p>
            ) : (
              <div className="card-list">
                {creditosDisponiveis.map((c) => (
                  <div className="item-card" key={c.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {c.motivo === "forca_maior" ? "Aula cancelada pelo Point" : "Cancelamento antecipado"}
                      </span>
                      <span className="item-card-subtitle">
                        {c.modalidade_nome} com {c.professor_nome} · aula de {c.data_aula}
                      </span>
                      <span className="item-card-subtitle">válido até {c.data_expiracao}</span>
                    </div>
                    <button onClick={() => setReagendandoCredito(c)}>Reagendar</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

/** Cancelar uma aula específica do aluno, pelo admin (pedido do usuário,
 * 2026-09-01) — mesma ideia do CancelarAulaModal do aluno, mas sem aviso
 * de prazo mínimo (o admin ignora isso) e com o crédito como checkbox. */
function CancelarAulaModalAdmin({
  ocorrencia,
  onFechar,
  onCancelado,
}: {
  ocorrencia: Ocorrencia;
  onFechar: () => void;
  onCancelado: () => void;
}) {
  const { matriculaId, data } = ocorrencia;
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

  const rotuloData = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function cancelar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/matriculas/${matriculaId}/aulas/${toISODate(data)}/cancelar-admin`, {
        gerar_credito: gerarCredito,
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
          <span className="item-card-title">{ocorrencia.modalidadeNome}</span>
          <span className="item-card-subtitle">
            {rotuloData} · {ocorrencia.horario} · {ocorrencia.quadraNome} · {ocorrencia.pointNome}
          </span>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={gerarCredito} onChange={(e) => setGerarCredito(e.target.checked)} />
          Gerar crédito de reposição pro aluno
        </label>
        <p className="empty-state" style={{ padding: 0 }}>
          Desmarque se for só correção de um cadastro errado (turma/dia trocados por engano) — nesse
          caso o aluno não perdeu uma aula de verdade.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <div className="modal-actions">
          <button disabled={enviando} onClick={cancelar}>
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

/** Turmas do professor que acontecem numa data específica — mesma lógica
 * de aluno/ReagendarCredito.tsx. */
function sessoesDoDia(turmas: TurmaResumo[], data: Date): TurmaResumo[] {
  const iso = toISODate(data);
  const diaSemana = diaSemanaDeData(data);
  return turmas
    .filter((t) => {
      if (!t.dias_semana.includes(diaSemana)) return false;
      if (iso < t.periodo_inicio) return false;
      if (t.periodo_fim !== null && iso > t.periodo_fim) return false;
      if (t.excecoes.includes(iso)) return false;
      return true;
    })
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

/** Reagendar um crédito do aluno, pelo admin (pedido do usuário,
 * 2026-09-01) — mesmo fluxo de aluno/ReagendarCredito.tsx (tira de dias +
 * sessões do professor do crédito), só que como popup em vez de tela
 * própria, já que aqui é uma ação a mais dentro da Agenda do aluno. */
function ReagendarCreditoModalAdmin({
  credito,
  onFechar,
  onReagendado,
}: {
  credito: Credito;
  onFechar: () => void;
  onReagendado: () => void;
}) {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date());
  const [sessaoSelecionada, setSessaoSelecionada] = useState<TurmaResumo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TurmaResumo[]>(`/turmas?professor_id=${credito.professor_id}`)
      .then(setTurmas)
      .finally(() => setCarregando(false));
  }, [credito.professor_id]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function confirmar() {
    if (!sessaoSelecionada) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/creditos/${credito.id}/reagendar-admin`, {
        turma_id: sessaoSelecionada.id,
        data_aula: toISODate(diaSelecionado),
      });
      onReagendado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível reagendar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const dias = Array.from({ length: DIAS_NA_TIRA }, (_, i) => somarDias(new Date(), i));
  const sessoes = sessoesDoDia(turmas, diaSelecionado);
  const rotuloDia = diaSelecionado
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">Reagendar crédito</span>
          <span className="item-card-subtitle">
            Aula de {credito.data_aula} · válido até {credito.data_expiracao} · só em turmas de{" "}
            {credito.professor_nome}
          </span>
        </div>

        {carregando && <p className="empty-state">Carregando...</p>}

        {!carregando && sessaoSelecionada && (
          <>
            <div className="item-card-info" style={{ marginTop: 10 }}>
              <span className="item-card-title">{sessaoSelecionada.modalidade.nome}</span>
              <span className="item-card-subtitle">
                {rotuloDia} · {sessaoSelecionada.horario} –{" "}
                {horarioFim(sessaoSelecionada.horario, sessaoSelecionada.duracao_minutos)} ·{" "}
                {sessaoSelecionada.quadra.nome}
              </span>
            </div>

            {erro && <p className="form-error">{erro}</p>}

            <div className="modal-actions">
              <button disabled={enviando} onClick={confirmar}>
                {enviando ? "Reagendando..." : "Confirmar reagendamento"}
              </button>
              <button
                className="secondary"
                disabled={enviando}
                onClick={() => setSessaoSelecionada(null)}
              >
                Escolher outra sessão
              </button>
            </div>
          </>
        )}

        {!carregando && !sessaoSelecionada && (
          <>
            <div className="day-strip" style={{ marginTop: 10 }}>
              {dias.map((data) => {
                const iso = toISODate(data);
                const ativo = iso === toISODate(diaSelecionado);
                const temSessao = sessoesDoDia(turmas, data).length > 0;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={ativo ? "day-pill active" : "day-pill"}
                    disabled={!temSessao}
                    onClick={() => setDiaSelecionado(data)}
                  >
                    <span className="day-pill-label">
                      {DIAS_SEMANA.find((d) => d.value === diaSemanaDeData(data))?.label ?? ""}
                    </span>
                    <span className="day-pill-numero">{data.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <h2 style={{ fontSize: 15, marginTop: 4 }}>{rotuloDia}</h2>
            {sessoes.length === 0 ? (
              <p className="empty-state">
                {credito.professor_nome} não tem nenhuma sessão nesse dia — escolha outro na tira acima.
              </p>
            ) : (
              <div className="card-list">
                {sessoes.map((t) => (
                  <div
                    key={t.id}
                    className="item-card item-card-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSessaoSelecionada(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSessaoSelecionada(t);
                    }}
                  >
                    <div className="item-card-info">
                      <span className="item-card-title">{t.modalidade.nome}</span>
                      <span className="item-card-subtitle">
                        {t.horario} – {horarioFim(t.horario, t.duracao_minutos)} · {t.quadra.nome}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="secondary" style={{ marginTop: 12 }} onClick={onFechar}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
