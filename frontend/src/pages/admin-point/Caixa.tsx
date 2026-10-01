import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { ContaCaixa, LancamentoCaixa, LancamentoTipo } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

type Filtro = "todos" | LancamentoTipo;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "saida", rotulo: "Saídas" },
];

/** "2026-09-05" — sem passar por UTC (toISOString mudaria o dia à noite). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-05" → "05/09". */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Caixa do Point (pedido do usuário, 2026-09-20: "mudar para Caixa, onde
 * tem entradas e saídas") — substitui o antigo Faturamento. Lançamentos do
 * mês (entradas vindas sozinhas das cobranças pagas + lançamentos manuais,
 * entradas ou saídas, com opção de repetir todo mês). Repasse a
 * professores e taxa de serviço saíram do sistema (2026-09-20).
 *
 * Layout do kit (design/telas/Caixa.dc.html; pedido do usuário,
 * 2026-10-01: "faça o caixa agora"). O protótipo é um caixa DO DIA (abrir/
 * fechar, gaveta); o app continua sendo o livro do mês — só o visual
 * segue o protótipo: números no topo, movimentações com ícone e, ao lado,
 * total por conta e os lançamentos fixos. */
export default function AdminPointCaixa() {
  const { confirmar, modal: modalConfirmar } = useConfirm();

  const [mes, setMes] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [lancamentos, setLancamentos] = useState<LancamentoCaixa[]>([]);
  const [contas, setContas] = useState<ContaCaixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [contaFiltro, setContaFiltro] = useState("");
  // null = fechado; LancamentoTipo = criando desse tipo; LancamentoCaixa = editando.
  const [formulario, setFormulario] = useState<LancamentoTipo | LancamentoCaixa | null>(null);
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const inicio = isoLocal(mes);
    const fim = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    try {
      const [lista, contasRes] = await Promise.all([
        api.get<LancamentoCaixa[]>(`/caixa/lancamentos?inicio=${inicio}&fim=${fim}`),
        api.get<ContaCaixa[]>("/caixa/contas"),
      ]);
      setLancamentos(lista);
      setContas(contasRes);
    } catch {
      setErro("Não foi possível carregar o caixa. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const listaEntradas = lancamentos.filter((l) => l.tipo === "entrada");
  const listaSaidas = lancamentos.filter((l) => l.tipo === "saida");
  const soma = (lista: LancamentoCaixa[]) => lista.reduce((total, l) => total + l.valor, 0);
  const entradas = soma(listaEntradas);
  const saidas = soma(listaSaidas);
  const saldo = entradas - saidas;
  const fixos = lancamentos.filter((l) => l.fixo_ativo);

  // Saldo por conta no mês (sem conta = "Sem conta").
  const porConta = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of lancamentos) {
      const nome = l.conta_nome ?? "Sem conta";
      mapa.set(nome, (mapa.get(nome) ?? 0) + (l.tipo === "entrada" ? l.valor : -l.valor));
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [lancamentos]);

  const visiveis = useMemo(
    () =>
      lancamentos
        .filter((l) => {
          if (filtro !== "todos" && l.tipo !== filtro) return false;
          if (contaFiltro && String(l.conta_id) !== contaFiltro) return false;
          return true;
        })
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id),
    [lancamentos, filtro, contaFiltro],
  );

  function mudarMes(delta: number) {
    setLoading(true);
    setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  }

  async function executar(id: number, acao: () => Promise<unknown>, falha: string) {
    setOcupadoId(id);
    setErro(null);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, falha));
    } finally {
      setOcupadoId(null);
    }
  }

  async function remover(l: LancamentoCaixa) {
    if (!(await confirmar(`Remover o lançamento "${l.descricao}"?`))) return;
    await executar(l.id, () => api.delete(`/caixa/lancamentos/${l.id}`), "Não foi possível remover.");
  }

  async function pararDeRepetir(l: LancamentoCaixa) {
    if (
      !(await confirmar(
        `Parar de repetir "${l.descricao}" todo mês? O que já foi lançado continua no caixa.`,
      ))
    )
      return;
    await executar(
      l.id,
      () => api.delete(`/caixa/fixos/${l.fixo_id}`),
      "Não foi possível parar a repetição.",
    );
  }

  const rotuloMes = mes
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">Financeiro</div>
          <div className="caixa-titulo-linha">
            <h1>Caixa</h1>
            <div className="caixa-mes">
              <button type="button" className="agenda-seta" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
                <Icon name="chevron-left" size={18} />
              </button>
              <span className="caixa-mes-rotulo">{rotuloMes}</span>
              <button type="button" className="agenda-seta" onClick={() => mudarMes(1)} aria-label="Próximo mês">
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="caixa-botoes">
          <button type="button" className="botao-link" onClick={() => setFormulario("entrada")}>
            + Entrada
          </button>
          <button type="button" className="botao-link botao-link-secundario" onClick={() => setFormulario("saida")}>
            − Saída
          </button>
        </div>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <div className="caixa-corpo">
          <div className="chk-kpis">
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Entradas</span>
              <span className="chk-kpi-valor caixa-entrada">{formatarReais(entradas)}</span>
              <span className="chk-kpi-nota">{plural(listaEntradas.length, "lançamento", "lançamentos")}</span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Saídas</span>
              <span className="chk-kpi-valor caixa-saida">{formatarReais(saidas)}</span>
              <span className="chk-kpi-nota">{plural(listaSaidas.length, "lançamento", "lançamentos")}</span>
            </div>
            <div className="chk-kpi escuro">
              <span className="chk-kpi-rotulo">Saldo do mês</span>
              <span className="chk-kpi-valor">{formatarReais(saldo)}</span>
              <span className="chk-kpi-nota">entradas − saídas</span>
            </div>
            <div className="chk-kpi limao">
              <span className="chk-kpi-rotulo">Lançamentos fixos</span>
              <span className="chk-kpi-valor">{fixos.length}</span>
              <span className="chk-kpi-nota">repetem todo mês sozinhos</span>
            </div>
          </div>

          <div className="caixa-layout">
            <section className="alunos-card caixa-movimentos">
              <div className="caixa-movimentos-topo">
                <h2 className="chk-secao-titulo">Movimentações</h2>
                <div className="caixa-filtros-novo">
                  <div className="agenda-passos" role="tablist" aria-label="Tipo">
                    {FILTROS.map((f) => (
                      <button
                        key={f.valor}
                        type="button"
                        role="tab"
                        aria-selected={filtro === f.valor}
                        className={filtro === f.valor ? "ativo" : ""}
                        onClick={() => setFiltro(f.valor)}
                      >
                        {f.rotulo}
                      </button>
                    ))}
                  </div>
                  {contas.length > 0 && (
                    <select
                      className="filtro-pilula"
                      aria-label="Filtrar por conta"
                      value={contaFiltro}
                      onChange={(e) => setContaFiltro(e.target.value)}
                    >
                      <option value="">Todas as contas</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {visiveis.length === 0 ? (
                <p className="alunos-vazio">
                  {lancamentos.length === 0
                    ? "Nenhum lançamento neste mês. As cobranças pagas entram sozinhas; o resto você lança em \"+ Entrada\" ou \"− Saída\"."
                    : "Nenhum lançamento com esses filtros."}
                </p>
              ) : (
                <ul className="caixa-lista">
                  {visiveis.map((l) => (
                    <li key={l.id} className="caixa-mov">
                      <span className={`caixa-mov-icone ${l.tipo}`} aria-hidden="true">
                        {l.tipo === "entrada" ? "↑" : "↓"}
                      </span>
                      <span className="caixa-mov-texto">
                        <span className="alunos-nome caixa-mov-descricao">
                          {l.descricao}
                          {l.fixo_id !== null && (
                            <span
                              className="caixa-mov-repete"
                              title={l.fixo_ativo ? "Repete todo mês" : "Repetição encerrada"}
                            >
                              <Icon name="repeat" size={13} />
                            </span>
                          )}
                        </span>
                        <span className="alunos-sub">
                          {diaMes(l.data)}
                          {l.conta_nome ? ` · ${l.conta_nome}` : ""}
                          {l.automatico ? " · automático (cobrança paga)" : ""}
                          {l.fixo_ativo ? " · fixo" : ""}
                        </span>
                      </span>
                      <strong className={`caixa-mov-valor ${l.tipo}`}>
                        {l.tipo === "entrada" ? "+" : "−"} {formatarReais(l.valor)}
                      </strong>
                      <span className="caixa-mov-acoes">
                        {l.fixo_ativo && (
                          <button
                            type="button"
                            className="cobr-icone"
                            title="Parar de repetir"
                            aria-label={`Parar de repetir ${l.descricao}`}
                            disabled={ocupadoId === l.id}
                            onClick={() => pararDeRepetir(l)}
                          >
                            <Icon name="pause" size={15} />
                          </button>
                        )}
                        {!l.automatico && (
                          <>
                            <button
                              type="button"
                              className="cobr-icone"
                              title="Editar"
                              aria-label={`Editar ${l.descricao}`}
                              disabled={ocupadoId === l.id}
                              onClick={() => setFormulario(l)}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="cobr-icone"
                              title="Remover"
                              aria-label={`Remover ${l.descricao}`}
                              disabled={ocupadoId === l.id}
                              onClick={() => remover(l)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="caixa-lateral">
              <section className="alunos-card">
                <h2 className="chk-secao-titulo">Por conta</h2>
                {porConta.length === 0 ? (
                  <p className="alunos-sub">Sem movimento no mês.</p>
                ) : (
                  <ul className="caixa-resumo-lista">
                    {porConta.map(([nome, valor]) => (
                      <li key={nome}>
                        <span>{nome}</span>
                        <strong className={valor < 0 ? "caixa-saida" : ""}>{formatarReais(valor)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="alunos-card">
                <h2 className="chk-secao-titulo">Lançamentos fixos</h2>
                <p className="alunos-sub caixa-fixos-dica">
                  Entram sozinhos todo mês, no mesmo dia. Pra criar um, marque "Repetir todo mês" no lançamento.
                </p>
                {fixos.length === 0 ? (
                  <p className="alunos-sub">Nenhum fixo ativo neste mês.</p>
                ) : (
                  <ul className="caixa-resumo-lista">
                    {fixos.map((l) => (
                      <li key={l.id}>
                        <span>
                          {l.descricao}
                          <span className="alunos-sub"> · dia {Number(l.data.slice(8, 10))}</span>
                        </span>
                        <strong className={l.tipo === "saida" ? "caixa-saida" : "caixa-entrada"}>
                          {l.tipo === "entrada" ? "+" : "−"} {formatarReais(l.valor)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {formulario !== null && (
        <LancamentoModal
          lancamento={typeof formulario === "string" ? null : formulario}
          tipoInicial={typeof formulario === "string" ? formulario : formulario.tipo}
          contas={contas}
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

const NOVA_CONTA = "__nova__";

function LancamentoModal({
  lancamento,
  tipoInicial,
  contas,
  onFechar,
  onSalvo,
}: {
  lancamento: LancamentoCaixa | null;
  tipoInicial: LancamentoTipo;
  contas: ContaCaixa[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = lancamento !== null;
  const [tipo, setTipo] = useState<LancamentoTipo>(lancamento?.tipo ?? tipoInicial);
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : "");
  const [data, setData] = useState(lancamento?.data ?? isoLocal(new Date()));
  const [conta, setConta] = useState(lancamento?.conta_id ? String(lancamento.conta_id) : "");
  const [nomeNovaConta, setNomeNovaConta] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      let contaId: number | null = conta && conta !== NOVA_CONTA ? Number(conta) : null;
      if (conta === NOVA_CONTA) {
        const nome = nomeNovaConta.trim();
        if (!nome) {
          setErro("Dê um nome para a nova conta.");
          setEnviando(false);
          return;
        }
        const nova = await api.post<ContaCaixa>("/caixa/contas", { nome });
        contaId = nova.id;
      }
      const corpo = {
        tipo,
        descricao: descricao.trim(),
        valor: Number(valor.replace(",", ".")),
        data,
        conta_id: contaId,
      };
      if (lancamento) {
        await api.patch(`/caixa/lancamentos/${lancamento.id}`, corpo);
      } else {
        await api.post("/caixa/lancamentos", { ...corpo, recorrente });
      }
      onSalvo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar o lançamento."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <form className="modal-card form-card" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="cobranca-modal-topo">
          <h2>{editando ? "Editar lançamento" : "Novo lançamento"}</h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="caixa-tipo">
          <button
            type="button"
            className={`caixa-tipo-btn entrada${tipo === "entrada" ? " active" : ""}`}
            onClick={() => setTipo("entrada")}
          >
            ↑ Entrada
          </button>
          <button
            type="button"
            className={`caixa-tipo-btn saida${tipo === "saida" ? " active" : ""}`}
            onClick={() => setTipo("saida")}
          >
            ↓ Saída
          </button>
        </div>

        <label>
          Descrição
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Aluguel da quadra"
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
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </label>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
        </div>

        <label>
          Conta
          <select value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Sem conta</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value={NOVA_CONTA}>+ Nova conta...</option>
          </select>
        </label>

        {conta === NOVA_CONTA && (
          <label>
            Nome da nova conta
            <input
              value={nomeNovaConta}
              onChange={(e) => setNomeNovaConta(e.target.value)}
              placeholder="Ex: Conta corrente"
              maxLength={60}
              autoFocus
            />
          </label>
        )}

        {!editando && (
          <label className="caixa-repetir">
            <span className="caixa-repetir-linha">
              <input
                type="checkbox"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
              />
              Repetir todo mês
            </span>
            <span className="caixa-repetir-dica">
              Vira um lançamento fixo: entra sozinho todo mês, no dia da data acima (nos meses
              mais curtos, no último dia).
            </span>
          </label>
        )}

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>
    </div>
  );
}
