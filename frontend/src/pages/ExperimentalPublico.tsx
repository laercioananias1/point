import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, urlArquivo } from "../api/client";
import { Icon } from "../components/Layout";
import type { PointResumo, TurmaExperimentalAgenda } from "../api/types";
import { formatarCelular } from "../lib/formato";

// Janela da página pública (pedido do usuário, 2026-09-14: "mostre
// somente 15 dias pra frente") — menor que o padrão do backend (21).
const DIAS_JANELA = 15;

// Abreviação sem ponto (pedido do usuário, 2026-09-14) — o Intl em pt-BR
// sempre põe "seg.", por isso a lista própria.
const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Horario = { turma: TurmaExperimentalAgenda; data: string; disponivel: boolean };
type Etapa = "escolha" | "dados" | "enviado";

function dataLocal(iso: string): Date {
  return new Date(iso + "T00:00");
}

/** "quarta, 7/10" */
function rotuloDiaCompleto(iso: string): string {
  const d = dataLocal(iso);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return `${semana}, ${d.getDate()}/${d.getMonth() + 1}`;
}

function resumo(h: Horario): string {
  const t = h.turma;
  return `${rotuloDiaCompleto(h.data)} às ${t.horario} · ${t.modalidade.nome} (${t.categoria.nome}) · ${t.quadra.nome} · com ${t.professor_nome}`;
}

/** Página pública (sem login) de aula experimental — pedido do usuário,
 * 2026-09-14: o visitante vê os horários com vaga e pede a aula; vira uma
 * SolicitacaoExperimental pendente que o professor/admin aprova depois.
 * Visual e fluxo em 3 passos (dia → horário → dados) do kit de design
 * (design/telas/Main.dc.html, seção "experimental"; pedido do usuário,
 * 2026-10-01). Nunca mostra número de ocupação — só tem vaga ou lotado. */
export default function ExperimentalPublico() {
  // Token opaco, não o id do Point (pedido do usuário, 2026-09-14).
  const { link } = useParams<{ link: string }>();
  const [point, setPoint] = useState<PointResumo | null>(null);
  const [turmas, setTurmas] = useState<TurmaExperimentalAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [dia, setDia] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<Horario | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [enviadoPara, setEnviadoPara] = useState<{ nome: string; celular: string } | null>(null);

  useEffect(() => {
    if (!link) return;
    Promise.all([
      api.get<PointResumo>(`/experimental/${link}/point`),
      api.get<TurmaExperimentalAgenda[]>(`/experimental/${link}/agenda?dias=${DIAS_JANELA}`),
    ])
      .then(([p, t]) => {
        setPoint(p);
        setTurmas(t);
      })
      .catch(() => setErroCarregar("Não foi possível carregar essa página — confira o link."))
      .finally(() => setCarregando(false));
  }, [link]);

  const horariosPorDia = useMemo(() => {
    const mapa = new Map<string, Horario[]>();
    for (const turma of turmas) {
      for (const d of turma.proximas_datas) {
        const lista = mapa.get(d.data) ?? [];
        lista.push({ turma, data: d.data, disponivel: d.disponivel });
        mapa.set(d.data, lista);
      }
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.turma.horario.localeCompare(b.turma.horario));
    return mapa;
  }, [turmas]);

  const dias = useMemo(() => Array.from(horariosPorDia.keys()).sort(), [horariosPorDia]);
  // Abre no primeiro dia que tem alguma vaga.
  const diaAtual =
    dia ?? dias.find((d) => horariosPorDia.get(d)?.some((h) => h.disponivel)) ?? dias[0] ?? null;
  const horariosDoDia = diaAtual ? (horariosPorDia.get(diaAtual) ?? []) : [];

  function escolherDia(d: string) {
    setDia(d);
    setEscolhido(null);
  }

  function aoEnviar(nome: string, celular: string) {
    if (!escolhido) return;
    setEnviadoPara({ nome, celular });
    setEtapa("enviado");
    // A solicitação pendente já ocupa a vaga (ver vagas_ocupadas_em) — tira
    // da lista sem recarregar.
    setTurmas((atual) =>
      atual.map((t) =>
        t.id !== escolhido.turma.id
          ? t
          : {
              ...t,
              proximas_datas: t.proximas_datas.map((d) =>
                d.data === escolhido.data ? { ...d, disponivel: false } : d,
              ),
            },
      ),
    );
  }

  function recomecar() {
    setEscolhido(null);
    setEnviadoPara(null);
    setEtapa("escolha");
  }

  return (
    <div className="exp-pagina">
      <div className="exp-conteudo">
        <div className="exp-intro">
          {point?.logo && <img src={urlArquivo(point.logo)} alt="" className="exp-logo" />}
          <span className="exp-tag">Aula experimental</span>
          <h1>{point?.nome ?? (carregando ? "Carregando..." : "Aula experimental")}</h1>
          {point?.endereco && (
            <span className="exp-endereco">
              <Icon name="pin" size={16} /> {point.endereco}
            </span>
          )}
          <p>
            Escolha o dia e o horário com vaga, informe seus dados e envie o pedido — sem
            compromisso e sem cadastro. O professor confirma a aula com você.
          </p>
          <ul className="exp-checks">
            <li>
              <Icon name="check-circle" size={18} /> Só aparecem horários com vaga de verdade
            </li>
            <li>
              <Icon name="check-circle" size={18} /> O professor confirma pelo WhatsApp
            </li>
          </ul>
        </div>

        <div className="exp-card">
          {carregando && <p className="empty-state">Carregando horários...</p>}
          {!carregando && erroCarregar && <p className="form-error">{erroCarregar}</p>}
          {!carregando && !erroCarregar && dias.length === 0 && (
            <p className="empty-state">
              Nenhum horário de aula experimental disponível agora — volte mais tarde.
            </p>
          )}

          {!carregando && !erroCarregar && dias.length > 0 && (
            <>
              {etapa !== "enviado" && (
                <div className="exp-card-topo">
                  <span className="exp-card-sub">Sem compromisso · gratuita</span>
                  <span className="exp-card-titulo">Agende sua aula experimental</span>
                </div>
              )}

              {etapa === "escolha" && (
                <>
                  <div className="exp-passo">
                    <span className="exp-passo-rotulo">1. Escolha o dia</span>
                    <div className="exp-dias">
                      {dias.map((d) => {
                        const data = dataLocal(d);
                        const temVaga = horariosPorDia.get(d)?.some((h) => h.disponivel);
                        return (
                          <button
                            key={d}
                            type="button"
                            className={d === diaAtual ? "exp-dia ativo" : "exp-dia"}
                            onClick={() => escolherDia(d)}
                            title={temVaga ? undefined : "Todos os horários desse dia estão lotados"}
                          >
                            <span className="exp-dia-semana">{DIAS_ABREV[data.getDay()]}</span>
                            <span className="exp-dia-numero">{data.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="exp-passo">
                    <span className="exp-passo-rotulo">2. Escolha o horário</span>
                    <div className="exp-horarios">
                      {horariosDoDia.map((h) => {
                        const ativo = escolhido?.turma.id === h.turma.id && escolhido.data === h.data;
                        return (
                          <button
                            key={`${h.turma.id}-${h.data}`}
                            type="button"
                            disabled={!h.disponivel}
                            className={ativo ? "exp-horario ativo" : "exp-horario"}
                            onClick={() => setEscolhido(h)}
                            title={`${h.turma.modalidade.nome} · ${h.turma.quadra.nome} · com ${h.turma.professor_nome}`}
                          >
                            <span>{h.turma.horario}</span>
                            <span className="exp-horario-sub">{h.turma.categoria.nome}</span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="exp-dica">Horários riscados já estão lotados.</span>
                  </div>

                  {escolhido && (
                    <div className="exp-resumo">
                      <Icon name="calendar" size={22} />
                      <span>Aula experimental: {resumo(escolhido)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="exp-cta"
                    disabled={!escolhido}
                    onClick={() => setEtapa("dados")}
                  >
                    Continuar
                  </button>
                </>
              )}

              {etapa === "dados" && escolhido && (
                <FormularioSolicitacao
                  horario={escolhido}
                  onTrocar={() => setEtapa("escolha")}
                  onEnviado={aoEnviar}
                />
              )}

              {etapa === "enviado" && escolhido && enviadoPara && (
                <div className="exp-feito">
                  <span className="exp-feito-icone">
                    <Icon name="check-circle" size={36} />
                  </span>
                  <span className="exp-feito-titulo">
                    Pedido enviado, {enviadoPara.nome.trim().split(" ")[0]}!
                  </span>
                  <p>Aula experimental: {resumo(escolhido)}</p>
                  <div className="exp-resumo">
                    <Icon name="clock" size={22} />
                    <span>
                      Aguardando confirmação do professor. Você vai receber a resposta no WhatsApp{" "}
                      {enviadoPara.celular}.
                    </span>
                  </div>
                  <button type="button" className="secondary" onClick={recomecar}>
                    Solicitar outro horário
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FormularioSolicitacao({
  horario,
  onTrocar,
  onEnviado,
}: {
  horario: Horario;
  onTrocar: () => void;
  onEnviado: (nome: string, celular: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [temRaquete, setTemRaquete] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const completo = Boolean(nome.trim() && email.trim() && celular.trim() && temRaquete !== null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/experimental/solicitar", {
        turma_id: horario.turma.id,
        data: horario.data,
        nome,
        email,
        celular: celular.trim(),
        tem_raquete: temRaquete,
      });
      onEnviado(nome, celular.trim());
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="exp-form" onSubmit={handleSubmit}>
      <div className="exp-resumo exp-resumo-trocar">
        <span>Aula experimental: {resumo(horario)}</span>
        <button type="button" className="link-btn" onClick={onTrocar}>
          Trocar horário
        </button>
      </div>

      <span className="exp-passo-rotulo">3. Seus dados</span>

      <label htmlFor="exp-nome">Nome</label>
      <input id="exp-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" required />

      <label htmlFor="exp-whats">WhatsApp</label>
      <input
        id="exp-whats"
        type="tel"
        placeholder="(11) 91234-5678"
        value={celular}
        onChange={(e) => setCelular(formatarCelular(e.target.value))}
        required
      />
      <span className="exp-dica">O professor vai confirmar a aula por este número.</span>

      <label htmlFor="exp-email">E-mail</label>
      <input id="exp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />

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

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" className="exp-cta exp-cta-destaque" disabled={enviando || !completo}>
        {enviando ? "Enviando..." : "Solicitar aula experimental"}
      </button>
    </form>
  );
}
