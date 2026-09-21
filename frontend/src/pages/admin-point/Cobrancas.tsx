import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Cobranca, CobrancaAluno, TurmaResumo } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";
import { rotuloTurma } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

type Filtro = "todos" | "abertos" | "atrasados" | "pagos";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "abertos", rotulo: "Abertos" },
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "pagos", rotulo: "Pagos" },
];

/** "2026-09-05" → "05/09" (só dia/mês, como no exemplo do pedido). */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
}

/** Tela de Cobranças do financeiro (pedido do usuário, 2026-09-20: "fazer
 * para o financeiro uma tela de cobrança") — cobranças avulsas por aluno
 * (criadas aqui) + mensalidades que entram sozinhas das assinaturas. */
export default function AdminPointCobrancas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmar, modal: modalConfirmar } = useConfirm();

  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [totalAutomaticas, setTotalAutomaticas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // null = fechado; "nova" = criando; Cobranca = editando.
  const [formulario, setFormulario] = useState<"nova" | Cobranca | null>(null);
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setErro(null);
    try {
      const [lista, auto, turmasRes] = await Promise.all([
        api.get<Cobranca[]>("/cobrancas"),
        api.get<{ total: number }>("/cobrancas/mensalidades-automaticas"),
        api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`),
      ]);
      setCobrancas(lista);
      setTotalAutomaticas(auto.total);
      setTurmas(turmasRes);
    } catch {
      setErro("Não foi possível carregar as cobranças. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalAberto = cobrancas
    .filter((c) => c.status === "aberta")
    .reduce((soma, c) => soma + c.valor, 0);
  const totalAtrasado = cobrancas
    .filter((c) => c.atrasada)
    .reduce((soma, c) => soma + c.valor, 0);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return cobrancas.filter((c) => {
      if (termo && !c.aluno_nome.toLowerCase().includes(termo)) return false;
      if (turmaId && !c.turma_ids.includes(Number(turmaId))) return false;
      if (filtro === "abertos") return c.status === "aberta";
      if (filtro === "atrasados") return c.atrasada;
      if (filtro === "pagos") return c.status === "paga";
      return true;
    });
  }, [cobrancas, busca, turmaId, filtro]);

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

  async function gerarAgora() {
    setErro(null);
    setAviso(null);
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
    }
  }

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
        <h1>Cobranças</h1>
      </div>

      <p className="cobranca-subtitulo">
        Cadastre aqui as cobranças de cada aluno — avulsas (únicas) ou mensalidade recorrente.
      </p>
      <p className="cobranca-auto">
        <Icon name="repeat" size={15} />
        <span>
          {totalAutomaticas} com mensalidade automática — as cobranças entram sozinhas todo dia 1.{" "}
          <button type="button" className="link-btn" onClick={gerarAgora}>
            gerar agora
          </button>
        </span>
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {aviso && <p className="form-success">{aviso}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <div className="stats-grid cobranca-resumo">
            <div className="stat-tile">
              <div className="stat-label">Em aberto</div>
              <div className="stat-value">{formatarReais(totalAberto)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Atrasado</div>
              <div className="stat-value cobranca-valor-atrasado">
                {formatarReais(totalAtrasado)}
              </div>
            </div>
          </div>

          <div className="cobranca-filtros">
            <input
              type="search"
              placeholder="Buscar cobrança pelo nome do aluno..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.modalidade.nome} · {t.categoria.nome} · {rotuloTurma(t.dias_semana, t.horario)}
                </option>
              ))}
            </select>
          </div>

          <div className="toggle-grid cobranca-chips">
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

          {visiveis.length === 0 ? (
            <p className="empty-state">
              {cobrancas.length === 0
                ? "Nenhuma cobrança ainda."
                : "Nenhuma cobrança com esses filtros."}
            </p>
          ) : (
            <div className="card-list">
              {visiveis.map((c) => (
                <div className="item-card cobranca-item" key={c.id}>
                  <div className="item-card-info">
                    <span className="item-card-title cobranca-aluno">
                      {c.aluno_nome}
                      {c.recorrente && (
                        <span className="cobranca-recorrente" title="Mensalidade recorrente">
                          <Icon name="repeat" size={13} />
                        </span>
                      )}
                    </span>
                    <span className="item-card-subtitle">
                      {c.descricao} · vence {diaMes(c.vencimento)}
                    </span>
                  </div>
                  <div className="cobranca-direita">
                    <div className="cobranca-valor-col">
                      <span className="cobranca-valor">{formatarReais(c.valor)}</span>
                      {c.status === "paga" ? (
                        <span className="status-pill status-good">
                          Pago{c.pago_em ? ` ${diaMes(c.pago_em)}` : ""}
                        </span>
                      ) : c.atrasada ? (
                        <span className="status-pill status-risk">Atrasado</span>
                      ) : null}
                    </div>
                    <div className="cobranca-acoes">
                      {c.status === "aberta" ? (
                        <>
                          <button
                            type="button"
                            className="cobranca-btn-pago"
                            disabled={ocupadoId === c.id}
                            onClick={() => pagar(c)}
                          >
                            <Icon name="check" size={14} />
                            Pago
                          </button>
                          <button
                            type="button"
                            className="secondary cobranca-btn-icone"
                            title="Lembrar por WhatsApp e e-mail"
                            aria-label="Lembrar por WhatsApp e e-mail"
                            disabled={ocupadoId === c.id}
                            onClick={() => lembrar(c)}
                          >
                            <Icon name="message" size={16} />
                          </button>
                          <button
                            type="button"
                            className="secondary cobranca-btn-icone"
                            title="Editar"
                            aria-label="Editar"
                            disabled={ocupadoId === c.id}
                            onClick={() => setFormulario(c)}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="secondary cobranca-btn-icone"
                            title="Remover"
                            aria-label="Remover"
                            disabled={ocupadoId === c.id}
                            onClick={() => remover(c)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          disabled={ocupadoId === c.id}
                          onClick={() => desfazerPagamento(c)}
                        >
                          Desfazer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button type="button" className="fab" onClick={() => setFormulario("nova")}>
        <Icon name="plus" />
        Nova cobrança
      </button>

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
