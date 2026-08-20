import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, Pagamento, TurmaResumo, Vinculo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

export default function AdminPointDashboard() {
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [vinculosRes, matriculasRes, pagamentosRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<Matricula[]>("/matriculas"),
        api.get<Pagamento[]>("/pagamentos"),
      ]);
      setVinculos(vinculosRes);
      setMatriculas(matriculasRes);
      setPagamentos(pagamentosRes);
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
                        {m.turma.modalidade} · {m.turma.dia_semana} {m.turma.horario} ·{" "}
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
                        {m.turma.modalidade} · {m.turma.dia_semana} {m.turma.horario}
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
              {t.modalidade} · {t.dia_semana} {t.horario} · com {t.vinculo.professor.nome}
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
