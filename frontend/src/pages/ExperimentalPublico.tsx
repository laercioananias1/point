import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { PointBrand } from "../components/PointBrand";
import { CategoriaBadge } from "../components/CategoriaBadge";
import type { PointResumo, TurmaExperimentalAgenda } from "../api/types";
import { aplicarCorDestaque } from "../lib/cor";
import { formatarCelular } from "../lib/formato";

// Janela da página pública (pedido do usuário, 2026-09-14: "mostre
// somente 15 dias pra frente") — menor que o padrão do backend (21), que
// continua servindo outros usos da mesma agenda.
const DIAS_JANELA = 15;

// Abreviação sem ponto (pedido do usuário, 2026-09-14: "os dias da semana
// não precisa desse seg., ter. — tira esse pontinho") — o formatador do
// Intl em pt-BR sempre inclui o ponto ("seg."), por isso a lista própria
// em vez de toLocaleDateString com weekday: "short".
const DIAS_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDataCurta(iso: string): string {
  const data = new Date(iso + "T00:00");
  return `${DIAS_ABREV[data.getDay()]} ${String(data.getDate()).padStart(2, "0")}`;
}

function rotuloHorarioTurma(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

type Selecionado = { turmaId: number; data: string; rotulo: string } | null;

/** Página pública (sem login) de aula experimental — pedido do usuário,
 * 2026-09-14: "criar uma pagina publica... poder solicitar uma aula
 * experimental. Ele conseguir ver agenda que tem aula esperimental livre
 * e fazer uma solicitacao". O professor divulga o link no WhatsApp/
 * Instagram; qualquer um abre, escolhe turma+data com vaga e manda os
 * próprios dados — vira uma SolicitacaoExperimental pendente, que o
 * professor/admin aprova depois (ver SolicitacoesExperimentais.tsx). */
export default function ExperimentalPublico() {
  const { pointId } = useParams<{ pointId: string }>();
  const [point, setPoint] = useState<PointResumo | null>(null);
  const [turmas, setTurmas] = useState<TurmaExperimentalAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Selecionado>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!pointId) return;
    Promise.all([
      api.get<PointResumo>(`/experimental/${pointId}/point`),
      api.get<TurmaExperimentalAgenda[]>(`/experimental/${pointId}/agenda?dias=${DIAS_JANELA}`),
    ])
      .then(([p, t]) => {
        setPoint(p);
        setTurmas(t);
        aplicarCorDestaque(p.cor_destaque);
      })
      .catch(() => setErroCarregar("Não foi possível carregar essa página — confira o link."))
      .finally(() => setCarregando(false));
    return () => aplicarCorDestaque(null);
  }, [pointId]);

  function aoConfirmar() {
    setEnviado(true);
    setSelecionado(null);
    // Tira a data escolhida da lista sem precisar recarregar tudo — a
    // solicitação pendente já ocupa a vaga (ver vagas_ocupadas_em).
    setTurmas((atual) =>
      atual.map((t) =>
        t.id !== selecionado?.turmaId
          ? t
          : {
              ...t,
              proximas_datas: t.proximas_datas.map((d) =>
                d.data === selecionado.data ? { ...d, disponivel: false } : d,
              ),
            },
      ),
    );
  }

  return (
    <div className="auth-screen">
      <div style={{ width: "100%", maxWidth: 480 }}>
        <PointBrand point={point} />

        {carregando && <p className="auth-card">Carregando...</p>}
        {!carregando && erroCarregar && <p className="auth-card auth-error">{erroCarregar}</p>}

        {!carregando && !erroCarregar && point && (
          <>
            <div className="auth-card">
              <h1>{point.nome}</h1>
              <p className="auth-subtitle" style={{ marginBottom: 4 }}>
                {point.endereco}
              </p>
              <p style={{ fontSize: 14, margin: 0 }}>
                Escolha um horário abaixo e peça uma aula experimental — sem compromisso, sem
                cadastro. O professor confirma com você por WhatsApp ou e-mail.
              </p>
            </div>

            {enviado && (
              <p className="auth-card form-success">
                Pedido enviado! O professor ou o Point vai confirmar com você em breve.
              </p>
            )}

            {turmas.length === 0 ? (
              <p className="auth-card empty-state">
                Nenhum horário de aula experimental disponível agora — volte mais tarde.
              </p>
            ) : (
              turmas.map((turma) => (
                <div className="auth-card" key={turma.id}>
                  <span className="item-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {turma.modalidade.nome}
                    <CategoriaBadge nome={turma.categoria.nome} cor={turma.categoria.cor} />
                  </span>
                  <p className="auth-subtitle" style={{ marginBottom: 10 }}>
                    Turma {rotuloHorarioTurma(turma.horario)} · {turma.quadra.nome} · com{" "}
                    {turma.professor_nome}
                  </p>
                  <div className="toggle-grid">
                    {turma.proximas_datas.length === 0 ? (
                      <span className="empty-state" style={{ padding: 0 }}>
                        Sem datas abertas nas próximas semanas.
                      </span>
                    ) : (
                      turma.proximas_datas.map((d) => (
                        <button
                          key={d.data}
                          type="button"
                          disabled={!d.disponivel}
                          className={
                            selecionado?.turmaId === turma.id && selecionado.data === d.data
                              ? "toggle-chip active"
                              : "toggle-chip"
                          }
                          onClick={() =>
                            setSelecionado({
                              turmaId: turma.id,
                              data: d.data,
                              rotulo: `${turma.modalidade.nome} · ${rotuloDataCurta(d.data)} · ${turma.horario}`,
                            })
                          }
                        >
                          {rotuloDataCurta(d.data)} {d.disponivel ? "" : "· sem vaga"}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}

            {selecionado && (
              <FormularioSolicitacao selecionado={selecionado} onConfirmar={aoConfirmar} onCancelar={() => setSelecionado(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormularioSolicitacao({
  selecionado,
  onConfirmar,
  onCancelar,
}: {
  selecionado: { turmaId: number; data: string; rotulo: string };
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [temRaquete, setTemRaquete] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (temRaquete === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/experimental/solicitar", {
        turma_id: selecionado.turmaId,
        data: selecionado.data,
        nome,
        email,
        celular: celular.trim(),
        tem_raquete: temRaquete,
      });
      onConfirmar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h2 style={{ marginBottom: 4 }}>Pedir aula experimental</h2>
      <p className="auth-subtitle">{selecionado.rotulo}</p>

      <label htmlFor="nome">Nome</label>
      <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />

      <label htmlFor="email">E-mail</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label htmlFor="celular">Celular</label>
      <input
        id="celular"
        type="tel"
        placeholder="(11) 91234-5678"
        value={celular}
        onChange={(e) => setCelular(formatarCelular(e.target.value))}
        required
      />

      <label>Já tem raquete própria?</label>
      <div className="toggle-grid">
        <button
          type="button"
          className={temRaquete === true ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setTemRaquete(true)}
        >
          Sim
        </button>
        <button
          type="button"
          className={temRaquete === false ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setTemRaquete(false)}
        >
          Não
        </button>
      </div>

      {erro && <p className="auth-error">{erro}</p>}

      <button type="submit" disabled={enviando || temRaquete === null || !nome || !email || !celular}>
        {enviando ? "Enviando..." : "Pedir aula experimental"}
      </button>
      <button type="button" className="secondary" onClick={onCancelar} disabled={enviando}>
        Cancelar
      </button>
    </form>
  );
}
