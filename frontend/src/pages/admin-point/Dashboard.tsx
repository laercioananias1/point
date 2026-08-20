import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type {
  Assinatura,
  Fechamento,
  Matricula,
  Pagamento,
  Plano,
  TurmaResumo,
  Vinculo,
} from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

const ROTULO_PERIODO: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

export default function AdminPointDashboard() {
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [vinculosRes, matriculasRes, pagamentosRes, assinaturasRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<Matricula[]>("/matriculas"),
        api.get<Pagamento[]>("/pagamentos"),
        api.get<Assinatura[]>("/assinaturas"),
      ]);
      setVinculos(vinculosRes);
      setMatriculas(matriculasRes);
      setPagamentos(pagamentosRes);
      setAssinaturas(assinaturasRes);
    } catch {
      setErro("Não foi possível carregar os dados do Point. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidirVinculo(id: number, decisao: "aprovar" | "recusar") {
    const chave = `vinculo-${id}`;
    setProcessando((atual) => new Set(atual).add(chave));
    try {
      await api.patch(`/vinculos/${id}/${decisao}`, {});
      await carregar();
    } finally {
      setProcessando((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  async function decidirMatricula(id: number, decisao: "aprovar" | "recusar") {
    const chave = `matricula-${id}`;
    setProcessando((atual) => new Set(atual).add(chave));
    try {
      await api.patch(`/matriculas/${id}/${decisao}`);
      await carregar();
    } finally {
      setProcessando((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  async function decidirPagamento(id: number, decisao: "confirmar" | "estornar") {
    const chave = `pagamento-${id}`;
    setProcessando((atual) => new Set(atual).add(chave));
    try {
      await api.patch(`/pagamentos/${id}/${decisao}`);
      await carregar();
    } finally {
      setProcessando((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  const vinculosPendentes = vinculos.filter((v) => v.status === "pendente");
  const vinculosDecididos = vinculos.filter((v) => v.status !== "pendente");
  const matriculasPendentes = matriculas.filter((m) => m.status === "em_analise");
  const matriculasDecididas = matriculas.filter((m) => m.status !== "em_analise");
  const pagamentosPendentes = pagamentos.filter(
    (p) => p.meio === "dinheiro" && p.status === "pendente",
  );
  const assinaturasPendentes = assinaturas.filter((a) => a.status === "em_analise");
  const assinaturasAtivas = assinaturas.filter((a) => a.status === "ativa");

  return (
    <Layout>
      <h1>Painel do Point</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <h2>Vínculos pendentes ({vinculosPendentes.length})</h2>
            {vinculosPendentes.length === 0 ? (
              <p className="empty-state">Nenhum vínculo aguardando aprovação.</p>
            ) : (
              <div className="card-list">
                {vinculosPendentes.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.professor.nome}</span>
                      <span className="item-card-subtitle">
                        {v.professor.modalidades.join(", ") || "sem modalidade informada"} · avulsa
                        R$ {v.preco_avulso.toFixed(2)} · plano R$ {v.preco_plano.toFixed(2)} ·
                        repasse {v.modelo_repasse.replaceAll("_", " ")} ({v.valor_repasse})
                      </span>
                    </div>
                    <div className="item-card-actions">
                      <button
                        disabled={processando.has(`vinculo-${v.id}`)}
                        onClick={() => decidirVinculo(v.id, "aprovar")}
                      >
                        Aprovar
                      </button>
                      <button
                        className="secondary"
                        disabled={processando.has(`vinculo-${v.id}`)}
                        onClick={() => decidirVinculo(v.id, "recusar")}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Matrículas pendentes ({matriculasPendentes.length})</h2>
            {matriculasPendentes.length === 0 ? (
              <p className="empty-state">Nenhuma matrícula aguardando aprovação.</p>
            ) : (
              <div className="card-list">
                {matriculasPendentes.map((m) => (
                  <div className="item-card" key={m.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{m.aluno.nome}</span>
                      <span className="item-card-subtitle">
                        {m.turma.modalidade.nome} · {m.turma.dia_semana} {m.turma.horario} ·{" "}
                        {m.tipo === "mensal" ? "plano mensal" : "aula avulsa"} · pagamento{" "}
                        {m.fonte_pagamento}
                      </span>
                    </div>
                    <div className="item-card-actions">
                      <button
                        disabled={processando.has(`matricula-${m.id}`)}
                        onClick={() => decidirMatricula(m.id, "aprovar")}
                      >
                        Aprovar
                      </button>
                      <button
                        className="secondary"
                        disabled={processando.has(`matricula-${m.id}`)}
                        onClick={() => decidirMatricula(m.id, "recusar")}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Assinaturas de plano mensal pendentes ({assinaturasPendentes.length})</h2>
            {assinaturasPendentes.length === 0 ? (
              <p className="empty-state">Nenhum interesse aguardando ativação.</p>
            ) : (
              <div className="card-list">
                {assinaturasPendentes.map((a) => (
                  <AtivarAssinaturaRow key={a.id} assinatura={a} onMudanca={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Assinaturas ativas ({assinaturasAtivas.length})</h2>
            {user?.point_id && <GerarAulasButton pointId={user.point_id} />}
            {assinaturasAtivas.length === 0 ? (
              <p className="empty-state">Nenhuma assinatura ativa ainda.</p>
            ) : (
              <div className="card-list">
                {assinaturasAtivas.map((a) => (
                  <div className="item-card" key={a.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {a.aluno.nome} · {a.modalidade.nome} · {a.plano?.frequencia_semanal}x/semana
                      </span>
                      <span className="item-card-subtitle">
                        {a.turmas.map((t) => `${t.dia_semana} ${t.horario}`).join(" · ")} · desde{" "}
                        {a.data_inicio}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Pagamentos em dinheiro pendentes ({pagamentosPendentes.length})</h2>
            {pagamentosPendentes.length === 0 ? (
              <p className="empty-state">Nenhum lançamento aguardando validação.</p>
            ) : (
              <div className="card-list">
                {pagamentosPendentes.map((p) => (
                  <div className="item-card" key={p.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {p.aluno_nome} · R$ {p.valor.toFixed(2)}
                      </span>
                      <span className="item-card-subtitle">{p.turma_modalidade}</span>
                    </div>
                    <div className="item-card-actions">
                      <button
                        disabled={processando.has(`pagamento-${p.id}`)}
                        onClick={() => decidirPagamento(p.id, "confirmar")}
                      >
                        Confirmar
                      </button>
                      <button
                        className="secondary"
                        disabled={processando.has(`pagamento-${p.id}`)}
                        onClick={() => decidirPagamento(p.id, "estornar")}
                      >
                        Estornar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Cancelar aula por força maior</h2>
            {user?.point_id ? (
              <CancelarAulaForm pointId={user.point_id} />
            ) : (
              <p className="empty-state">Não foi possível identificar o seu Point.</p>
            )}
          </section>

          <section className="section">
            <h2>Fechamento mensal</h2>
            {user?.point_id ? (
              <FechamentoSection pointId={user.point_id} />
            ) : (
              <p className="empty-state">Não foi possível identificar o seu Point.</p>
            )}
          </section>

          <section className="section">
            <h2>Vínculos do Point ({vinculosDecididos.length})</h2>
            {vinculosDecididos.length === 0 ? (
              <p className="empty-state">Nenhum outro vínculo por aqui ainda.</p>
            ) : (
              <div className="card-list">
                {vinculosDecididos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.professor.nome}</span>
                      <span className="item-card-subtitle">
                        {v.professor.modalidades.join(", ") || "sem modalidade informada"}
                      </span>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Matrículas do Point ({matriculasDecididas.length})</h2>
            {matriculasDecididas.length === 0 ? (
              <p className="empty-state">Nenhuma outra matrícula por aqui ainda.</p>
            ) : (
              <div className="card-list">
                {matriculasDecididas.map((m) => (
                  <div className="item-card" key={m.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{m.aluno.nome}</span>
                      <span className="item-card-subtitle">
                        {m.turma.modalidade.nome} · {m.turma.dia_semana} {m.turma.horario}
                      </span>
                    </div>
                    <StatusPill status={m.status} />
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

function AtivarAssinaturaRow({
  assinatura,
  onMudanca,
}: {
  assinatura: Assinatura;
  onMudanca: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [recusando, setRecusando] = useState(false);

  async function recusar() {
    setRecusando(true);
    try {
      await api.patch(`/assinaturas/${assinatura.id}/recusar`);
      onMudanca();
    } finally {
      setRecusando(false);
    }
  }

  return (
    <div className="item-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div className="item-card-info">
          <span className="item-card-title">
            {assinatura.aluno.nome} · {assinatura.modalidade.nome}
          </span>
          <span className="item-card-subtitle">
            {assinatura.frequencia_semanal_desejada}x por semana · período{" "}
            {ROTULO_PERIODO[assinatura.periodo_dia_desejado]} · pagamento {assinatura.fonte_pagamento}
          </span>
        </div>
        <div className="item-card-actions">
          <button onClick={() => setExpandido((v) => !v)}>{expandido ? "Fechar" : "Ativar"}</button>
          <button className="secondary" disabled={recusando} onClick={recusar}>
            {recusando ? "Recusando..." : "Recusar"}
          </button>
        </div>
      </div>
      {expandido && (
        <AtivarForm
          assinatura={assinatura}
          onAtivado={() => {
            setExpandido(false);
            onMudanca();
          }}
        />
      )}
    </div>
  );
}

function AtivarForm({ assinatura, onAtivado }: { assinatura: Assinatura; onAtivado: () => void }) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState<number | null>(null);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaResumo[]>([]);
  const [turmaIds, setTurmaIds] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Plano[]>(`/planos?point_id=${assinatura.point_id}`).then((res) => {
      setPlanos(res);
      const sugerido = res.find((p) => p.frequencia_semanal === assinatura.frequencia_semanal_desejada);
      setPlanoId((sugerido ?? res[0])?.id ?? null);
    });
    api
      .get<TurmaResumo[]>(
        `/turmas?point_id=${assinatura.point_id}&modalidade_id=${assinatura.modalidade.id}` +
          `&periodo_dia=${assinatura.periodo_dia_desejado}`,
      )
      .then(setTurmasDisponiveis);
  }, [assinatura]);

  const frequenciaAlvo = planos.find((p) => p.id === planoId)?.frequencia_semanal ?? 0;

  function alternarTurma(id: number) {
    setTurmaIds((atual) => (atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (planoId === null) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.patch(`/assinaturas/${assinatura.id}/ativar`, {
        plano_id: planoId,
        turma_ids: turmaIds,
        data_inicio: dataInicio,
      });
      onAtivado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível ativar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  if (planos.length === 0) {
    return <p className="empty-state">Cadastre um plano (aba Cadastro) antes de ativar.</p>;
  }

  return (
    <form
      className="form-card"
      onSubmit={handleSubmit}
      style={{ marginTop: "14px", maxWidth: "none" }}
    >
      <div className="form-row">
        <label>
          Plano
          <select
            value={planoId ?? ""}
            onChange={(e) => {
              setPlanoId(Number(e.target.value));
              setTurmaIds([]);
            }}
          >
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.frequencia_semanal}x por semana — R$ {p.preco.toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data de início
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
        </label>
      </div>

      <label>
        Turmas ({turmaIds.length} de {frequenciaAlvo} escolhidas)
        {turmasDisponiveis.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Nenhuma turma dessa modalidade no período pedido — crie uma turma antes, ou peça pro
            professor.
          </p>
        ) : (
          <div className="toggle-grid">
            {turmasDisponiveis.map((t) => (
              <button
                key={t.id}
                type="button"
                className={turmaIds.includes(t.id) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => alternarTurma(t.id)}
              >
                {t.dia_semana} {t.horario}
              </button>
            ))}
          </div>
        )}
      </label>

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" disabled={enviando || turmaIds.length !== frequenciaAlvo}>
        {enviando ? "Ativando..." : "Confirmar ativação"}
      </button>
    </form>
  );
}

function GerarAulasButton({ pointId }: { pointId: number }) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);

  async function gerar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await api.post<{ aulas_geradas: number }>(
        `/assinaturas/points/${pointId}/gerar-aulas-do-mes`,
      );
      setResultado(res.aulas_geradas);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
      <button className="secondary" disabled={enviando} onClick={gerar}>
        {enviando ? "Gerando..." : "Gerar aulas do mês"}
      </button>
      {resultado !== null && (
        <span className="empty-state" style={{ padding: 0 }}>
          {resultado} aula(s) gerada(s).
        </span>
      )}
    </div>
  );
}

function CancelarAulaForm({ pointId }: { pointId: number }) {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [dataAula, setDataAula] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);

  useEffect(() => {
    api.get<TurmaResumo[]>(`/turmas?point_id=${pointId}`).then((res) => {
      setTurmas(res);
      setTurmaId(res[0]?.id ?? null);
    });
  }, [pointId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (turmaId === null) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const creditos = await api.post<unknown[]>(`/turmas/${turmaId}/cancelamentos`, {
        data_aula: dataAula,
      });
      setResultado(creditos.length);
    } catch {
      setErro("Não foi possível cancelar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (turmas.length === 0) {
    return <p className="empty-state">Nenhuma turma no seu Point ainda.</p>;
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <label>
        Turma
        <select value={turmaId ?? ""} onChange={(e) => setTurmaId(Number(e.target.value))}>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.modalidade.nome} · {t.dia_semana} {t.horario} · com {t.vinculo.professor.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Data da aula cancelada
        <input type="date" value={dataAula} onChange={(e) => setDataAula(e.target.value)} required />
      </label>

      <p className="empty-state" style={{ padding: 0 }}>
        Gera crédito de reposição pra todo aluno com matrícula ativa nessa turma.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {resultado !== null && (
        <p className="form-success">
          {resultado === 0
            ? "Nenhuma matrícula ativa nessa turma — nenhum crédito gerado."
            : `${resultado} crédito(s) de reposição gerado(s).`}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? "Cancelando..." : "Cancelar aula"}
      </button>
    </form>
  );
}

function primeiroDiaDoMes(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

function ultimoDiaDoMes(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function FechamentoSection({ pointId }: { pointId: number }) {
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes());
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaDoMes());
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setFechamentos(await api.get<Fechamento[]>(`/points/${pointId}/fechamentos`));
    } finally {
      setLoading(false);
    }
  }, [pointId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGerando(true);
    setErro(null);
    try {
      await api.post(`/points/${pointId}/fechamentos`, {
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
      });
      await carregar();
    } catch {
      setErro("Não foi possível gerar o fechamento. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <form
        className="form-card"
        onSubmit={handleSubmit}
        style={{ marginBottom: "20px" }}
      >
        <div className="form-row">
          <label>
            Início do período
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              required
            />
          </label>
          <label>
            Fim do período
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              required
            />
          </label>
        </div>
        <p className="empty-state" style={{ padding: 0 }}>
          Soma a taxa de serviço sobre os pagamentos confirmados do período e calcula o repasse de
          cada professor. Na prática isso roda sozinho no 5º dia útil — aqui dá pra disparar na mão.
        </p>
        {erro && <p className="form-error">{erro}</p>}
        <button type="submit" disabled={gerando}>
          {gerando ? "Gerando..." : "Gerar fechamento"}
        </button>
      </form>

      {loading ? (
        <p className="empty-state">Carregando...</p>
      ) : fechamentos.length === 0 ? (
        <p className="empty-state">Nenhum fechamento gerado ainda.</p>
      ) : (
        <div className="card-list">
          {fechamentos.map((f) => (
            <div className="item-card" key={f.id} style={{ alignItems: "flex-start" }}>
              <div className="item-card-info">
                <span className="item-card-title">
                  {f.periodo_inicio} a {f.periodo_fim}
                </span>
                <span className="item-card-subtitle">
                  {f.quantidade_pagamentos} pagamento(s) · taxa de R$ {f.taxa_servico_unitaria.toFixed(2)}{" "}
                  cada · total R$ {f.total_taxa_servico.toFixed(2)} pro SaaS
                </span>
                {f.repasses.length > 0 && (
                  <span className="item-card-subtitle">
                    Repasse:{" "}
                    {f.repasses
                      .map((r) => `${r.professor_nome} R$ ${r.valor.toFixed(2)}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
