import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type {
  Cobranca,
  CobrancaAluno,
  PagamentoOnlineConfig,
  Point,
  ReguaCobranca,
  TurmaResumo,
} from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";
import { rotuloTurma } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

type Filtro = "todos" | "abertos" | "atrasados" | "pagos";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "abertos", rotulo: "Abertas" },
  { valor: "atrasados", rotulo: "Atrasadas" },
  { valor: "pagos", rotulo: "Pagas" },
];

/** "2026-09-05" → "05/09" (só dia/mês, como no exemplo do pedido). */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
}

function noFiltro(c: Cobranca, filtro: Filtro): boolean {
  if (filtro === "abertos") return c.status === "aberta";
  if (filtro === "atrasados") return c.atrasada;
  if (filtro === "pagos") return c.status === "paga";
  return true;
}

/** Tela de Cobranças do financeiro (pedido do usuário, 2026-09-20: "fazer
 * para o financeiro uma tela de cobrança") — cobranças avulsas por aluno
 * (criadas aqui) + mensalidades que entram sozinhas das assinaturas.
 *
 * Layout do kit (design/telas/Cobrancas.dc.html; pedido do usuário,
 * 2026-10-01: "essa tela de cobrança também precisa de um tapa"): números
 * no topo, tabela com abas e ações na linha e, ao lado, a régua de
 * cobrança (pedido do usuário, 2026-10-01: "pode fazer a régua de
 * cobrança" — lembretes automáticos por etapa), a prévia da mensagem e a
 * mensalidade automática. */
export default function AdminPointCobrancas() {
  const { user } = useAuth();
  const { confirmar, modal: modalConfirmar } = useConfirm();
  // Pagamento online (pedido do usuário, 2026-10-02): com o Point
  // recebendo Pix pelo gateway, cada cobrança aberta tem link de pagamento.
  const [pagamentoOnline, setPagamentoOnline] = useState(false);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  useEffect(() => {
    api
      .get<PagamentoOnlineConfig>("/points/me/pagamento-online")
      .then((c) => setPagamentoOnline(c.ativo))
      .catch(() => setPagamentoOnline(false));
  }, []);

  async function copiarLink(c: Cobranca) {
    const link = `${window.location.origin}/pagar/${c.pagamento_token}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copie o link de pagamento:", link);
    }
    setCopiadoId(c.id);
    window.setTimeout(() => setCopiadoId((atual) => (atual === c.id ? null : atual)), 2500);
  }

  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [totalAutomaticas, setTotalAutomaticas] = useState(0);
  const [regua, setRegua] = useState<ReguaCobranca | null>(null);
  const [salvandoRegua, setSalvandoRegua] = useState(false);
  const [pointNome, setPointNome] = useState("seu Point");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // null = fechado; "nova" = criando; Cobranca = editando.
  const [formulario, setFormulario] = useState<"nova" | Cobranca | null>(null);
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setErro(null);
    try {
      const [lista, auto, turmasRes, reguaRes] = await Promise.all([
        api.get<Cobranca[]>("/cobrancas"),
        api.get<{ total: number }>("/cobrancas/mensalidades-automaticas"),
        api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`),
        api.get<ReguaCobranca>("/cobrancas/regua"),
      ]);
      api
        .get<Point>("/points/me")
        .then((p) => setPointNome(p.nome))
        .catch(() => undefined);
      setCobrancas(lista);
      setTotalAutomaticas(auto.total);
      setTurmas(turmasRes);
      setRegua(reguaRes);
    } catch {
      setErro("Não foi possível carregar as cobranças. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const nomeMes = hoje
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());

  const abertas = cobrancas.filter((c) => c.status === "aberta");
  const atrasadas = cobrancas.filter((c) => c.atrasada);
  const pagasNoMes = cobrancas.filter((c) => c.status === "paga" && c.pago_em?.startsWith(mesAtual));
  const soma = (lista: Cobranca[]) => lista.reduce((total, c) => total + c.valor, 0);

  // Busca e turma valem pra todas as abas — a contagem de cada aba já
  // considera os dois.
  const filtradasSemAba = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return cobrancas.filter((c) => {
      if (termo && !c.aluno_nome.toLowerCase().includes(termo)) return false;
      if (turmaId && !c.turma_ids.includes(Number(turmaId))) return false;
      return true;
    });
  }, [cobrancas, busca, turmaId]);
  const visiveis = filtradasSemAba
    .filter((c) => noFiltro(c, filtro))
    .sort((a, b) => Number(b.atrasada) - Number(a.atrasada) || a.vencimento.localeCompare(b.vencimento));

  async function executar(id: number, acao: () => Promise<unknown>, falha: string) {
    setOcupadoId(id);
    setErro(null);
    setAviso(null);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, falha));
    } finally {
      setOcupadoId(null);
    }
  }

  const pagar = (c: Cobranca) =>
    executar(c.id, () => api.patch(`/cobrancas/${c.id}/pagar`), "Não foi possível marcar como paga.");

  async function desfazerPagamento(c: Cobranca) {
    if (!(await confirmar(`Desfazer o pagamento de ${c.aluno_nome} (${c.descricao})?`))) return;
    await executar(
      c.id,
      () => api.patch(`/cobrancas/${c.id}/reabrir`),
      "Não foi possível desfazer o pagamento.",
    );
  }

  async function remover(c: Cobranca) {
    if (!(await confirmar(`Remover a cobrança "${c.descricao}" de ${c.aluno_nome}?`))) return;
    await executar(
      c.id,
      () => api.delete(`/cobrancas/${c.id}`),
      "Não foi possível remover a cobrança.",
    );
  }

  async function lembrar(c: Cobranca) {
    await executar(
      c.id,
      async () => {
        await api.post(`/cobrancas/${c.id}/lembrete`);
        setAviso(`Lembrete enviado para ${c.aluno_nome}.`);
      },
      "Não foi possível enviar o lembrete.",
    );
  }

  // Liga/desliga uma etapa da régua e salva na hora.
  async function alternarEtapa(dias: number) {
    if (!regua) return;
    const ligadas = regua.etapas.filter((e) => e.ativa).map((e) => e.dias);
    const novas = ligadas.includes(dias) ? ligadas.filter((d) => d !== dias) : [...ligadas, dias];
    setSalvandoRegua(true);
    setErro(null);
    try {
      setRegua(await api.patch<ReguaCobranca>("/cobrancas/regua", { dias: novas }));
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar a régua de cobrança."));
    } finally {
      setSalvandoRegua(false);
    }
  }

  async function gerarAgora() {
    setErro(null);
    setAviso(null);
    setGerando(true);
    try {
      const res = await api.post<{ criadas: number }>("/cobrancas/gerar-mensalidades");
      setAviso(
        res.criadas === 0
          ? "As mensalidades deste mês já estavam geradas."
          : `${res.criadas} mensalidade(s) gerada(s).`,
      );
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível gerar as mensalidades."));
    } finally {
      setGerando(false);
    }
  }

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">Financeiro · {nomeMes}</div>
          <h1>Cobranças</h1>
        </div>
        <button type="button" className="botao-link" onClick={() => setFormulario("nova")}>
          + Nova cobrança
        </button>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {aviso && <p className="form-success">{aviso}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <div className="chk-kpis cobr-kpis">
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Em aberto</span>
              <span className="chk-kpi-valor">{formatarReais(soma(abertas))}</span>
              <span className="chk-kpi-nota">
                {abertas.length} {abertas.length === 1 ? "cobrança" : "cobranças"}
              </span>
            </div>
            <div className={atrasadas.length > 0 ? "chk-kpi cobr-kpi-atraso" : "chk-kpi"}>
              <span className="chk-kpi-rotulo">Atrasado</span>
              <span className="chk-kpi-valor">{formatarReais(soma(atrasadas))}</span>
              <span className="chk-kpi-nota">
                {atrasadas.length === 0
                  ? "nada vencido"
                  : `${atrasadas.length} ${atrasadas.length === 1 ? "cobrança vencida" : "cobranças vencidas"}`}
              </span>
            </div>
            <div className="chk-kpi limao">
              <span className="chk-kpi-rotulo">Recebido no mês</span>
              <span className="chk-kpi-valor">{formatarReais(soma(pagasNoMes))}</span>
              <span className="chk-kpi-nota">
                {pagasNoMes.length} {pagasNoMes.length === 1 ? "pagamento" : "pagamentos"}
              </span>
            </div>
          </div>

          <div className="cobr-layout">
            <section className="alunos-card cobr-lista">
              <div className="cobr-filtros">
                <div className="agenda-passos" role="tablist" aria-label="Situação">
                  {FILTROS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      role="tab"
                      aria-selected={filtro === f.valor}
                      className={filtro === f.valor ? "ativo" : ""}
                      onClick={() => setFiltro(f.valor)}
                    >
                      {f.rotulo}{" "}
                      <span className="cobr-contagem">{filtradasSemAba.filter((c) => noFiltro(c, f.valor)).length}</span>
                    </button>
                  ))}
                </div>
                <div className="cobr-busca">
                  <input
                    type="search"
                    className="cobr-busca-campo"
                    placeholder="Buscar aluno"
                    aria-label="Buscar aluno"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                  {turmas.length > 0 && (
                    <select
                      className="filtro-pilula"
                      aria-label="Filtrar por turma"
                      value={turmaId}
                      onChange={(e) => setTurmaId(e.target.value)}
                    >
                      <option value="">Todas as turmas</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.modalidade.nome} · {t.categoria.nome} · {rotuloTurma(t.dias_semana, t.horario)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {visiveis.length === 0 ? (
                <p className="alunos-vazio">
                  {cobrancas.length === 0
                    ? "Nenhuma cobrança ainda. Crie uma em \"+ Nova cobrança\" ou gere as mensalidades do mês."
                    : "Nenhuma cobrança com esses filtros."}
                </p>
              ) : (
                <div className="alunos-tabela" role="table" aria-label="Cobranças">
                  <div className="alunos-linha cobr-grade alunos-cabecalho" role="row">
                    <span role="columnheader">Aluno</span>
                    <span role="columnheader">Valor</span>
                    <span role="columnheader">Vencimento</span>
                    <span role="columnheader">Situação</span>
                    <span role="columnheader" aria-label="Ações" />
                  </div>
                  {visiveis.map((c) => (
                    <div key={c.id} className="alunos-linha cobr-grade" role="row">
                      <div className="alunos-pessoa-texto" role="cell">
                        <span className="alunos-nome cobr-aluno">
                          {c.aluno_nome}
                          {c.recorrente && (
                            <span className="cobr-recorrente" title="Mensalidade recorrente">
                              <Icon name="repeat" size={13} />
                            </span>
                          )}
                        </span>
                        <span className="alunos-sub">{c.descricao}</span>
                      </div>
                      <span role="cell" data-rotulo="Valor" className="cobr-valor">
                        {formatarReais(c.valor)}
                      </span>
                      <span role="cell" data-rotulo="Vencimento">
                        {diaMes(c.vencimento)}
                      </span>
                      <span role="cell" data-rotulo="Situação">
                        {c.status === "paga" ? (
                          <span className="status-pill status-good">
                            Paga{c.pago_em ? ` ${diaMes(c.pago_em)}` : ""}
                            {c.pago_via === "pix" ? " · Pix" : ""}
                          </span>
                        ) : c.atrasada ? (
                          <span className="status-pill status-risk">Atrasada</span>
                        ) : (
                          <span className="status-pill status-neutral">Em aberto</span>
                        )}
                      </span>
                      <span role="cell" className="cobr-acoes">
                        {c.status === "aberta" ? (
                          <>
                            <button
                              type="button"
                              className="cobr-btn cobr-btn-pagar"
                              disabled={ocupadoId === c.id}
                              onClick={() => pagar(c)}
                            >
                              Marcar paga
                            </button>
                            <button
                              type="button"
                              className={c.ultimo_lembrete_em ? "cobr-btn lembrado" : "cobr-btn"}
                              title={
                                c.ultimo_lembrete_em
                                  ? `Último lembrete em ${diaMes(c.ultimo_lembrete_em)} — clique pra lembrar de novo`
                                  : "Lembrar por WhatsApp e e-mail"
                              }
                              disabled={ocupadoId === c.id}
                              onClick={() => lembrar(c)}
                            >
                              <Icon name={c.ultimo_lembrete_em ? "check" : "message"} size={14} />
                              {c.ultimo_lembrete_em ? `Lembrado ${diaMes(c.ultimo_lembrete_em)}` : "Lembrar"}
                            </button>
                            {pagamentoOnline && (
                              <button
                                type="button"
                                className={copiadoId === c.id ? "cobr-icone copiado" : "cobr-icone"}
                                title={copiadoId === c.id ? "Link copiado!" : "Copiar link de pagamento Pix"}
                                aria-label={`Copiar link de pagamento de ${c.aluno_nome}`}
                                onClick={() => copiarLink(c)}
                              >
                                <Icon name={copiadoId === c.id ? "check" : "link"} size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="cobr-icone"
                              title="Editar"
                              aria-label={`Editar cobrança de ${c.aluno_nome}`}
                              disabled={ocupadoId === c.id}
                              onClick={() => setFormulario(c)}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="cobr-icone"
                              title="Remover"
                              aria-label={`Remover cobrança de ${c.aluno_nome}`}
                              disabled={ocupadoId === c.id}
                              onClick={() => remover(c)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="alunos-acao"
                            disabled={ocupadoId === c.id}
                            onClick={() => desfazerPagamento(c)}
                          >
                            Desfazer pagamento
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="cobr-lateral">
              <section className="cobr-regua">
                <h2>Régua de cobrança</h2>
                <p>
                  Lembretes automáticos por WhatsApp e e-mail para quem está com cobrança em aberto. Saem
                  todo dia às 9h, uma vez por etapa.
                </p>
                {regua?.etapas.map((e) => (
                  <button
                    key={e.dias}
                    type="button"
                    role="switch"
                    aria-checked={e.ativa}
                    className={e.ativa ? "cobr-etapa ligada" : "cobr-etapa"}
                    disabled={salvandoRegua}
                    onClick={() => alternarEtapa(e.dias)}
                  >
                    <span>
                      <span className="cobr-etapa-titulo">{e.titulo}</span>
                      <span className="cobr-etapa-descricao">{e.descricao}</span>
                    </span>
                    <span className="cobr-chave" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                ))}
                {regua && regua.etapas.some((e) => e.ativa) ? (
                  <span className="cobr-regua-hoje">
                    {regua.hoje === 0
                      ? "Nenhum lembrete pra hoje."
                      : `${regua.hoje} ${regua.hoje === 1 ? "lembrete sai" : "lembretes saem"} hoje às 9h.`}
                  </span>
                ) : (
                  <span className="cobr-regua-hoje">Régua desligada — ligue as etapas que quiser.</span>
                )}
              </section>

              <section className="alunos-card cobr-previa">
                <h2 className="chk-secao-titulo">Prévia da mensagem</h2>
                {(() => {
                  // Prévia com uma cobrança de verdade (a mais atrasada em
                  // aberto) ou um exemplo, quando não tem nenhuma.
                  const base = [...abertas].sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
                  const nome = base ? base.aluno_nome.split(" ")[0] : "Thiago";
                  const descricao = base ? base.descricao : "Mensalidade de outubro";
                  const valor = formatarReais(base ? base.valor : 280);
                  const vencimento = base ? diaMes(base.vencimento) : "05/10";
                  return (
                    <div className="cobr-previa-balao">
                      Olá, {nome}! Você tem uma cobrança em aberto no {pointNome}: {descricao}, no valor de{" "}
                      {valor}, com vencimento em {vencimento}.
                    </div>
                  );
                })()}
                <span className="alunos-sub">
                  Exemplo com os dados da cobrança. No WhatsApp vai o texto do modelo aprovado na Meta,
                  com esses mesmos dados; no e-mail, o texto da plataforma.
                </span>
              </section>

              <section className="alunos-card cobr-auto">
                <div className="cobr-auto-topo">
                  <span className="cobr-auto-icone">
                    <Icon name="repeat" size={18} />
                  </span>
                  <h2 className="chk-secao-titulo">Mensalidade automática</h2>
                </div>
                <p className="alunos-sub">
                  <strong>{totalAutomaticas}</strong>{" "}
                  {totalAutomaticas === 1 ? "aluno tem" : "alunos têm"} mensalidade definida no cadastro — a
                  cobrança entra sozinha todo dia 1.
                </p>
                <button type="button" className="secondary" disabled={gerando} onClick={gerarAgora}>
                  {gerando ? "Gerando..." : "Gerar as deste mês agora"}
                </button>
              </section>
            </div>
          </div>
        </>
      )}

      {formulario !== null && (
        <CobrancaModal
          cobranca={formulario === "nova" ? null : formulario}
          onFechar={() => setFormulario(null)}
          onSalvo={() => {
            setFormulario(null);
            carregar();
          }}
        />
      )}
      {modalConfirmar}
    </Layout>
  );
}

function CobrancaModal({
  cobranca,
  onFechar,
  onSalvo,
}: {
  cobranca: Cobranca | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = cobranca !== null;
  const [alunos, setAlunos] = useState<CobrancaAluno[]>([]);
  const [alunoId, setAlunoId] = useState(cobranca ? String(cobranca.aluno_id) : "");
  const [descricao, setDescricao] = useState(cobranca?.descricao ?? "Mensalidade");
  const [valor, setValor] = useState(cobranca ? String(cobranca.valor) : "");
  const [vencimento, setVencimento] = useState(cobranca?.vencimento ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (editando) return;
    api
      .get<CobrancaAluno[]>("/cobrancas/alunos")
      .then(setAlunos)
      .catch(() => setErro("Não foi possível carregar os alunos."));
  }, [editando]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const corpo = {
      descricao: descricao.trim(),
      valor: Number(valor.replace(",", ".")),
      vencimento,
    };
    try {
      if (cobranca) {
        await api.patch(`/cobrancas/${cobranca.id}`, corpo);
      } else {
        await api.post("/cobrancas", { ...corpo, aluno_id: Number(alunoId) });
      }
      onSalvo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar a cobrança."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <form className="modal-card form-card" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="cobranca-modal-topo">
          <h2>{editando ? "Editar cobrança" : "Nova cobrança"}</h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <label>
          Aluno
          {editando ? (
            <input value={cobranca.aluno_nome} disabled />
          ) : (
            <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} required>
              <option value="">Selecione...</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          )}
        </label>

        <label>
          Descrição
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={120}
            required
          />
        </label>

        <div className="form-row">
          <label>
            Valor (R$)
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="120,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </label>
          <label>
            Vencimento
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              required
            />
          </label>
        </div>

        {!editando && (
          <p className="cobranca-dica">
            Cobrança avulsa (uniforme, matrícula, evento). Para mensalidade que repete todo mês,
            defina a mensalidade no cadastro do aluno — aí ela entra sozinha.
          </p>
        )}

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : editando ? "Salvar" : "Criar cobrança"}
        </button>
      </form>
    </div>
  );
}
