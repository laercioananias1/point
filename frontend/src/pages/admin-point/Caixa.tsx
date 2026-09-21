import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ContaCaixa, LancamentoCaixa, LancamentoTipo } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

type Filtro = "todos" | LancamentoTipo;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
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

/** Caixa do Point (pedido do usuário, 2026-09-20: "mudar para Caixa, onde
 * tem entradas e saídas") — substitui o antigo Faturamento. Lançamentos do
 * mês (entradas vindas sozinhas das cobranças pagas + lançamentos manuais,
 * entradas ou saídas, com opção de repetir todo mês). Repasse a
 * professores e taxa de serviço saíram do sistema (2026-09-20). */
export default function AdminPointCaixa() {
  const navigate = useNavigate();
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
  // null = fechado; "novo" = criando; LancamentoCaixa = editando.
  const [formulario, setFormulario] = useState<"novo" | LancamentoCaixa | null>(null);
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

  const entradas = lancamentos
    .filter((l) => l.tipo === "entrada")
    .reduce((soma, l) => soma + l.valor, 0);
  const saidas = lancamentos
    .filter((l) => l.tipo === "saida")
    .reduce((soma, l) => soma + l.valor, 0);
  const saldo = entradas - saidas;

  const visiveis = useMemo(
    () =>
      lancamentos.filter((l) => {
        if (filtro !== "todos" && l.tipo !== filtro) return false;
        if (contaFiltro && String(l.conta_id) !== contaFiltro) return false;
        return true;
      }),
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

  const rotuloMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Caixa</h1>
      </div>

      <p className="cobranca-subtitulo">
        Tudo que entra e sai do Point. As cobranças pagas entram sozinhas; o resto você lança aqui.
      </p>

      <>
      <div className="caixa-mes-nav">
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <span className="caixa-mes-rotulo">{rotuloMes}</span>
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <div className="stats-grid caixa-resumo">
            <div className="stat-tile">
              <div className="stat-label">Entradas</div>
              <div className="stat-value caixa-valor-entrada">{formatarReais(entradas)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Saídas</div>
              <div className="stat-value caixa-valor-saida">{formatarReais(saidas)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Saldo</div>
              <div className={`stat-value ${saldo < 0 ? "caixa-valor-saida" : ""}`}>
                {formatarReais(saldo)}
              </div>
            </div>
          </div>

          <div className="caixa-filtros">
            <div className="toggle-grid">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className={`toggle-chip${filtro === f.valor ? " active" : ""}`}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            {contas.length > 0 && (
              <select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)}>
                <option value="">Todas as contas</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="empty-state">
              {lancamentos.length === 0
                ? "Nenhum lançamento neste mês."
                : "Nenhum lançamento com esses filtros."}
            </p>
          ) : (
            <div className="card-list">
              {visiveis.map((l) => (
                <div className="item-card cobranca-item" key={l.id}>
                  <div className="item-card-info">
                    <span className="item-card-title cobranca-aluno">
                      {l.descricao}
                      {l.fixo_id !== null && (
                        <span
                          className="cobranca-recorrente"
                          title={l.fixo_ativo ? "Repete todo mês" : "Repetição encerrada"}
                        >
                          <Icon name="repeat" size={13} />
                        </span>
                      )}
                    </span>
                    <span className="item-card-subtitle">
                      {diaMes(l.data)}
                      {l.conta_nome && ` · ${l.conta_nome}`}
                      {l.automatico && " · automático"}
                    </span>
                  </div>
                  <div className="cobranca-direita">
                    <span
                      className={`cobranca-valor ${
                        l.tipo === "entrada" ? "caixa-valor-entrada" : "caixa-valor-saida"
                      }`}
                    >
                      {l.tipo === "entrada" ? "+" : "−"} {formatarReais(l.valor)}
                    </span>
                    <div className="cobranca-acoes">
                      {l.fixo_ativo && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={ocupadoId === l.id}
                          onClick={() => pararDeRepetir(l)}
                        >
                          Parar de repetir
                        </button>
                      )}
                      {!l.automatico && (
                        <>
                          <button
                            type="button"
                            className="secondary cobranca-btn-icone"
                            title="Editar"
                            aria-label="Editar"
                            disabled={ocupadoId === l.id}
                            onClick={() => setFormulario(l)}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="secondary cobranca-btn-icone"
                            title="Remover"
                            aria-label="Remover"
                            disabled={ocupadoId === l.id}
                            onClick={() => remover(l)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button type="button" className="fab" onClick={() => setFormulario("novo")}>
        <Icon name="plus" />
        Novo lançamento
      </button>
      </>

      {formulario !== null && (
        <LancamentoModal
          lancamento={formulario === "novo" ? null : formulario}
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
  contas,
  onFechar,
  onSalvo,
}: {
  lancamento: LancamentoCaixa | null;
  contas: ContaCaixa[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = lancamento !== null;
  const [tipo, setTipo] = useState<LancamentoTipo>(lancamento?.tipo ?? "entrada");
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
