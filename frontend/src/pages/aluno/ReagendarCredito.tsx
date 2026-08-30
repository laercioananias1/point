import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Credito, TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { diaSemanaDeData, somarDias, toISODate } from "../../components/Calendar";
import { DIAS_SEMANA, horarioFim } from "../../lib/dias";

const DIAS_NA_TIRA = 21;

/** Turmas do professor que acontecem numa data específica (dia da semana
 * bate, dentro do período, não é uma data cancelada) — ordenadas por
 * horário. Mesma checagem que o backend faz de novo na hora de confirmar. */
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

/** Pedido do usuário, 2026-08-26: "quero uma tela parecida com essa" (grade
 * de academia — tira de dias horizontal no topo + lista de sessões do dia
 * selecionado) — substituiu o fluxo anterior de "escolher turma → escolher
 * data numa lista" por um mais direto: escolhe o DIA primeiro, vê todas as
 * sessões desse professor nesse dia, escolhe uma. */
export default function AlunoReagendarCredito() {
  const { creditoId } = useParams<{ creditoId: string }>();
  const navigate = useNavigate();
  const [credito, setCredito] = useState<Credito | null>(null);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date());
  const [sessaoSelecionada, setSessaoSelecionada] = useState<TurmaResumo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!creditoId) return;
    api
      .get<Credito[]>("/alunos/me/creditos")
      .then(async (creditos) => {
        const encontrado = creditos.find((c) => c.id === Number(creditoId));
        if (!encontrado) {
          setErroCarregar("Crédito não encontrado.");
          return;
        }
        setCredito(encontrado);
        setTurmas(await api.get<TurmaResumo[]>(`/turmas?professor_id=${encontrado.professor_id}`));
      })
      .catch(() => setErroCarregar("Não foi possível carregar o crédito."))
      .finally(() => setCarregando(false));
  }, [creditoId]);

  async function confirmar() {
    if (!sessaoSelecionada || !credito) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/creditos/${credito.id}/reagendar`, {
        turma_id: sessaoSelecionada.id,
        data_aula: toISODate(diaSelecionado),
      });
      navigate("/aluno");
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
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/aluno")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Reagendar crédito</h1>
      </div>

      {carregando && <p className="empty-state">Carregando...</p>}
      {!carregando && (erroCarregar || !credito) && (
        <p className="form-error">{erroCarregar ?? "Crédito não encontrado."}</p>
      )}

      {!carregando && credito && (
        <>
          <p className="empty-state" style={{ paddingTop: 0 }}>
            Crédito da aula de {credito.data_aula} · válido até {credito.data_expiracao} · só em turmas
            de {credito.professor_nome}.
          </p>

          {sessaoSelecionada ? (
            <div className="section">
              <div className="item-card-info">
                <span className="item-card-title">{sessaoSelecionada.modalidade.nome}</span>
                <span className="item-card-subtitle">
                  {rotuloDia} · {sessaoSelecionada.horario} –{" "}
                  {horarioFim(sessaoSelecionada.horario, sessaoSelecionada.duracao_minutos)} ·{" "}
                  {sessaoSelecionada.quadra.nome} · {sessaoSelecionada.vinculo.point.nome}
                </span>
              </div>

              {erro && <p className="form-error">{erro}</p>}

              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button disabled={enviando} onClick={confirmar}>
                  {enviando ? "Reagendando..." : "Confirmar reagendamento"}
                </button>
                <button className="secondary" disabled={enviando} onClick={() => setSessaoSelecionada(null)}>
                  Escolher outra sessão
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="day-strip">
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
                  {credito.professor_nome} não tem nenhuma sessão nesse dia — escolha outro na tira
                  acima.
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
                          {t.horario} – {horarioFim(t.horario, t.duracao_minutos)} · {t.quadra.nome} ·{" "}
                          {t.vinculo.point.nome}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
