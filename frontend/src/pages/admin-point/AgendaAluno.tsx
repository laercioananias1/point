import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Assinatura, Credito, HistoricoEvento, Matricula, TurmaResumo } from "../../api/types";
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
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [historico, setHistorico] = useState<HistoricoEvento[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Ocorrencia | null>(null);
  const [reagendandoCredito, setReagendandoCredito] = useState<Credito | null>(null);
  const [pausando, setPausando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, creditosRes, assinaturasRes, historicoRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Credito[]>("/matriculas/creditos"),
        api.get<Assinatura[]>("/assinaturas"),
        api.get<HistoricoEvento[]>("/matriculas/historico"),
      ]);
      setMatriculas(matriculasRes);
      setCreditos(creditosRes);
      setAssinaturas(assinaturasRes);
      setHistorico(historicoRes);
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
  const alunoResumo = matriculasDoAluno[0]?.aluno ?? null;
  const nomeAluno = alunoResumo?.nome ?? "";
  const assinaturasAtivasDoAluno = assinaturas.filter(
    (a) => a.aluno.id === idAluno && a.status === "ativa",
  );
  const historicoDoAluno = historico.filter((h) => h.aluno_id === idAluno);

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

      {/* Contato/e-mail saíram da lista de Alunos (pedido do usuário,
          2026-09-01: "deixe somente o nome nessa lista, os detalhes abre
          na outra página") — moram aqui agora. */}
      {alunoResumo && (
        <p className="empty-state" style={{ paddingTop: 0 }}>
          {alunoResumo.contato}
          {alunoResumo.email && ` · ${alunoResumo.email}`}
        </p>
      )}

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

      {pausando && (
        <PausarPeriodoModal
          matriculas={ativas}
          onFechar={() => setPausando(false)}
          onPausado={() => {
            setPausando(false);
            carregar();
          }}
        />
      )}

      {pronto && (
        <>
          <section className="section">
            {ativas.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button type="button" className="secondary" onClick={() => setPausando(true)}>
                  Pausar um período
                </button>
              </div>
            )}
            {ativas.length === 0 ? (
              <p className="empty-state">Esse aluno não tem matrícula mensal ativa.</p>
            ) : (
              <AgendaAlunoCalendario matriculas={ativas} onCancelar={setCancelando} paraAdmin />
            )}
          </section>

          {assinaturasAtivasDoAluno.length > 0 && (
            <section className="section">
              <h2>Assinatura</h2>
              <div className="card-list">
                {assinaturasAtivasDoAluno.map((a) => (
                  <AssinaturaRowAdmin key={a.id} assinatura={a} onCancelada={carregar} />
                ))}
              </div>
            </section>
          )}

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

          <section className="section">
            <h2>Histórico ({historicoDoAluno.length})</h2>
            {historicoDoAluno.length === 0 ? (
              <p className="empty-state">Nenhum cancelamento registrado pra esse aluno ainda.</p>
            ) : (
              <div className="card-list">
                {historicoDoAluno.map((h, i) => (
                  <div className="item-card" key={i}>
                    <div className="item-card-info">
                      <span className="item-card-title">{h.detalhe}</span>
                      <span className="item-card-subtitle">
                        {new Date(h.data_hora).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {h.cancelado_por_nome && ` · por ${h.cancelado_por_nome}`}
                      </span>
                    </div>
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

/** Encerrar a assinatura de vez (pedido do usuário, 2026-09-01: "tem que
 * ter as 2 opcoes: cancelamento de matricula, limpa tudo") — mesma ação
 * de AssinaturaAtivaRow em admin-point/Aluno.tsx, só que reaproveitada
 * aqui pra não precisar sair da Agenda do aluno pra encerrar o plano. */
function AssinaturaRowAdmin({
  assinatura,
  onCancelada,
}: {
  assinatura: Assinatura;
  onCancelada: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);

  async function cancelar() {
    if (!confirm(`Cancelar a assinatura de ${assinatura.aluno.nome}? Isso encerra o plano de vez.`)) {
      return;
    }
    setCancelando(true);
    try {
      await api.patch(`/assinaturas/${assinatura.id}/cancelar`);
      onCancelada();
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {assinatura.modalidade.nome} · {assinatura.plano?.frequencia_semanal}x/semana
        </span>
        <span className="item-card-subtitle">desde {assinatura.data_inicio}</span>
      </div>
      <button className="secondary" disabled={cancelando} onClick={cancelar}>
        {cancelando ? "Cancelando..." : "Cancelar assinatura"}
      </button>
    </div>
  );
}

/** Pausar um período de aulas, mantendo a matrícula ativa (pedido do
 * usuário, 2026-09-01: "opcao de pausar um periodo... o aluno volta
 * depois normalmente" — diferente de cancelar a assinatura de vez).
 * Aplica em todas as matrículas mensais ativas do aluno de uma vez (ex.:
 * aluno viajando, para todas as modalidades que ele frequenta). */
function PausarPeriodoModal({
  matriculas,
  onFechar,
  onPausado,
}: {
  matriculas: Matricula[];
  onFechar: () => void;
  onPausado: () => void;
}) {
  const hoje = toISODate(new Date());
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [gerarCredito, setGerarCredito] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ datas: number; creditos: number } | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      let datas = 0;
      let creditosGerados = 0;
      for (const m of matriculas) {
        const res = await api.post<{ datas_canceladas: string[]; creditos_gerados: number }>(
          `/matriculas/${m.id}/aulas/pausar`,
          { data_inicio: dataInicio, data_fim: dataFim, gerar_credito: gerarCredito },
        );
        datas += res.datas_canceladas.length;
        creditosGerados += res.creditos_gerados;
      }
      setResultado({ datas, creditos: creditosGerados });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível pausar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">Pausar um período</span>
        </div>

        {resultado ? (
          <>
            <p className="form-success">
              {resultado.datas} aula(s) pausada(s)
              {resultado.creditos > 0 ? `, ${resultado.creditos} crédito(s) gerado(s)` : ""}. Fora desse
              período, a agenda volta ao normal sozinha.
            </p>
            <div className="modal-actions">
              <button onClick={onPausado}>Fechar</button>
            </div>
          </>
        ) : (
          <>
            <p className="empty-state" style={{ padding: 0 }}>
              Cancela todas as aulas do aluno (em todas as turmas mensais ativas) entre as duas datas.
              Depois desse período, a agenda volta ao normal sozinha — não precisa reativar nada.
            </p>

            <div className="form-row">
              <label>
                De
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </label>
              <label>
                Até
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={gerarCredito}
                onChange={(e) => setGerarCredito(e.target.checked)}
                style={{ width: "auto" }}
              />
              Gerar crédito de reposição pra cada aula pausada
            </label>

            {erro && <p className="form-error">{erro}</p>}

            <div className="modal-actions">
              <button disabled={enviando || dataFim < dataInicio} onClick={confirmar}>
                {enviando ? "Pausando..." : "Confirmar pausa"}
              </button>
              <button className="secondary" disabled={enviando} onClick={onFechar}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
  // Motivo do cancelamento (pedido do usuário, 2026-09-01: "o professor
  // pode cancelar uma aula de um determinado aluno de última hora,
  // precisa informar o motivo") — mesmo padrão de chips já usado no
  // cancelamento por turma (GerenciarAulaModal em AgendaTurmasCalendario).
  const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);
  const [motivoOutro, setMotivoOutro] = useState("");
  const usandoOutro = motivoSelecionado === "outro";
  const motivoFinal = (usandoOutro ? motivoOutro : motivoSelecionado)?.trim() || null;
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
    if (!motivoFinal) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/matriculas/${matriculaId}/aulas/${toISODate(data)}/cancelar-admin`, {
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
          <span className="item-card-title">{ocorrencia.modalidadeNome}</span>
          <span className="item-card-subtitle">
            {rotuloData} · {ocorrencia.horario} · {ocorrencia.quadraNome} · {ocorrencia.pointNome}
          </span>
        </div>

        <div style={{ marginTop: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 6 }}>
            Motivo do cancelamento
          </span>
          <div className="toggle-grid">
            {/* Motivos de aluno (pedido do usuário, 2026-09-01: "os
                motivos de aluno são: doença, motivo pessoal, outros",
                depois "troque doença para saúde") — diferente do
                cancelamento por turma inteira, que é sobre o tempo. */}
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
