import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Fechamento, Matricula, ModeloRepasse, Vinculo } from "../../api/types";
import { Layout } from "../../components/Layout";

const MODELOS_REPASSE: { value: ModeloRepasse; label: string }[] = [
  { value: "percentual", label: "Percentual" },
  { value: "valor_fixo_mensal", label: "Valor fixo mensal" },
  { value: "valor_fixo_por_aula", label: "Valor fixo por aula" },
];

function rotuloModelo(modelo: ModeloRepasse): string {
  return MODELOS_REPASSE.find((m) => m.value === modelo)?.label ?? modelo;
}

export default function AdminPointFaturamento() {
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Set<number>>(new Set());

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      const [vinculosRes, matriculasRes, fechamentosRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<Matricula[]>("/matriculas"),
        api.get<Fechamento[]>(`/points/${user.point_id}/fechamentos`),
      ]);
      setVinculos(vinculosRes);
      setMatriculas(matriculasRes);
      setFechamentos(fechamentosRes);
    } catch {
      setErro("Não foi possível carregar o faturamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function removerExcecao(matriculaId: number) {
    setProcessando((atual) => new Set(atual).add(matriculaId));
    try {
      await api.patch(`/matriculas/${matriculaId}/repasse`, { modelo: null, valor: null });
      await carregar();
    } finally {
      setProcessando((atual) => {
        const proximo = new Set(atual);
        proximo.delete(matriculaId);
        return proximo;
      });
    }
  }

  const comExcecao = matriculas.filter((m) => m.repasse_override_modelo !== null);
  const semExcecaoAtivas = matriculas.filter(
    (m) => m.repasse_override_modelo === null && m.status === "ativa",
  );
  const totalTaxa = fechamentos.reduce((soma, f) => soma + f.total_taxa_servico, 0);
  const totalRepassado = fechamentos.reduce(
    (soma, f) => soma + f.repasses.reduce((s, r) => s + r.valor, 0),
    0,
  );

  return (
    <Layout>
      <h1>Faturamento</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <div className="stats-grid">
              <div className="stat-tile">
                <div className="stat-label">Fechamentos gerados</div>
                <div className="stat-value">{fechamentos.length}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Taxa de serviço total</div>
                <div className="stat-value">R$ {totalTaxa.toFixed(2)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Repassado a professores</div>
                <div className="stat-value">R$ {totalRepassado.toFixed(2)}</div>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Repasse padrão por vínculo ({vinculos.length})</h2>
            {vinculos.length === 0 ? (
              <p className="empty-state">Nenhum vínculo ainda.</p>
            ) : (
              <div className="card-list">
                {vinculos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.professor.nome}</span>
                      <span className="item-card-subtitle">
                        {rotuloModelo(v.modelo_repasse)} · {v.valor_repasse}
                        {v.modelo_repasse === "percentual" ? "%" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Exceções de repasse por aluno ({comExcecao.length})</h2>
            {comExcecao.length === 0 ? (
              <p className="empty-state">Nenhuma exceção definida — todo mundo usa o padrão do vínculo.</p>
            ) : (
              <div className="card-list">
                {comExcecao.map((m) => (
                  <div className="item-card" key={m.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{m.aluno.nome}</span>
                      <span className="item-card-subtitle">
                        {m.turma.modalidade} · {rotuloModelo(m.repasse_override_modelo!)} ·{" "}
                        {m.repasse_override_valor}
                        {m.repasse_override_modelo === "percentual" ? "%" : ""}
                      </span>
                    </div>
                    <button
                      className="secondary"
                      disabled={processando.has(m.id)}
                      onClick={() => removerExcecao(m.id)}
                    >
                      {processando.has(m.id) ? "Removendo..." : "Remover exceção"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Definir nova exceção</h2>
            {semExcecaoAtivas.length === 0 ? (
              <p className="empty-state">Nenhuma matrícula ativa sem exceção pra ajustar.</p>
            ) : (
              <NovaExcecaoForm matriculas={semExcecaoAtivas} onDefinido={carregar} />
            )}
          </section>

          <section className="section">
            <h2>Histórico de fechamentos ({fechamentos.length})</h2>
            {fechamentos.length === 0 ? (
              <p className="empty-state">
                Nenhum fechamento gerado ainda — dá pra gerar na tela de Aprovações.
              </p>
            ) : (
              <div className="card-list">
                {fechamentos.map((f) => (
                  <div className="item-card" key={f.id} style={{ alignItems: "flex-start" }}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {f.periodo_inicio} a {f.periodo_fim}
                      </span>
                      <span className="item-card-subtitle">
                        {f.quantidade_pagamentos} pagamento(s) · taxa total R${" "}
                        {f.total_taxa_servico.toFixed(2)}
                      </span>
                      {f.repasses.map((r) => (
                        <span className="item-card-subtitle" key={r.professor_id}>
                          {r.professor_nome}: R$ {r.valor.toFixed(2)}
                        </span>
                      ))}
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

function NovaExcecaoForm({
  matriculas,
  onDefinido,
}: {
  matriculas: Matricula[];
  onDefinido: () => void;
}) {
  const [matriculaId, setMatriculaId] = useState(matriculas[0]?.id ?? 0);
  const [modelo, setModelo] = useState<ModeloRepasse>("percentual");
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.patch(`/matriculas/${matriculaId}/repasse`, { modelo, valor: Number(valor) });
      setValor("");
      onDefinido();
    } catch {
      setErro("Não foi possível salvar. Confira os valores e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <label>
        Aluno / matrícula
        <select value={matriculaId} onChange={(e) => setMatriculaId(Number(e.target.value))}>
          {matriculas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.aluno.nome} · {m.turma.modalidade}
            </option>
          ))}
        </select>
      </label>

      <label>
        Modelo
        <select value={modelo} onChange={(e) => setModelo(e.target.value as ModeloRepasse)}>
          {MODELOS_REPASSE.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        {modelo === "percentual" ? "Percentual (%)" : "Valor (R$)"}
        <input
          type="number"
          min="0"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
      </label>

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Definir exceção"}
      </button>
    </form>
  );
}
