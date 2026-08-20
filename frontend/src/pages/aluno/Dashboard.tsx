import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { Matricula, MatriculaTipo, PagamentoMeio, TurmaResumo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

export default function AlunoDashboard() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setMatriculas(await api.get<Matricula[]>("/alunos/me/matriculas"));
    } catch {
      setErro("Não foi possível carregar sua agenda. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ativas = matriculas.filter((m) => m.status === "ativa");
  const emAnalise = matriculas.filter((m) => m.status === "em_analise");
  const encerradas = matriculas.filter((m) => m.status === "recusada" || m.status === "cancelada");
  const turmasJaMatriculadas = new Set(matriculas.map((m) => m.turma_id));

  return (
    <Layout>
      <h1>Minha agenda</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <h2>Aulas ativas ({ativas.length})</h2>
            {ativas.length === 0 ? (
              <p className="empty-state">Nenhuma matrícula ativa ainda.</p>
            ) : (
              <MatriculaLista matriculas={ativas} onPago={carregar} />
            )}
          </section>

          {emAnalise.length > 0 && (
            <section className="section">
              <h2>Aguardando aprovação do Point ({emAnalise.length})</h2>
              <MatriculaLista matriculas={emAnalise} />
            </section>
          )}

          {encerradas.length > 0 && (
            <section className="section">
              <h2>Histórico ({encerradas.length})</h2>
              <MatriculaLista matriculas={encerradas} />
            </section>
          )}

          <section className="section">
            <h2>Buscar turmas</h2>
            <BuscarTurmas jaMatriculadoEm={turmasJaMatriculadas} onMatricular={carregar} />
          </section>
        </>
      )}
    </Layout>
  );
}

function MatriculaLista({
  matriculas,
  onPago,
}: {
  matriculas: Matricula[];
  onPago?: () => void;
}) {
  return (
    <div className="card-list">
      {matriculas.map((m) => (
        <div className="item-card" key={m.id}>
          <div className="item-card-info">
            <span className="item-card-title">{m.turma.modalidade}</span>
            <span className="item-card-subtitle">
              {m.turma.dia_semana} {m.turma.horario} · {m.turma.vinculo.point.nome} · com{" "}
              {m.turma.vinculo.professor.nome} · {m.tipo === "mensal" ? "plano mensal" : "avulsa"}
            </span>
          </div>
          {onPago && m.status === "ativa" ? (
            <PagamentoStatusOuBotao matricula={m} onPago={onPago} />
          ) : (
            <StatusPill status={m.status} />
          )}
        </div>
      ))}
    </div>
  );
}

function PagamentoStatusOuBotao({
  matricula,
  onPago,
}: {
  matricula: Matricula;
  onPago: () => void;
}) {
  const jaConfirmado = matricula.pagamentos.some((p) => p.status === "confirmado");
  const [enviando, setEnviando] = useState(false);

  if (jaConfirmado) return <StatusPill status="confirmado" />;

  const valor =
    matricula.tipo === "mensal"
      ? matricula.turma.vinculo.preco_plano
      : matricula.turma.vinculo.preco_avulso;

  async function pagar() {
    setEnviando(true);
    try {
      await api.post("/pagamentos", { matricula_id: matricula.id, valor, meio: "pix" });
      onPago();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button disabled={enviando} onClick={pagar}>
      {enviando ? "Pagando..." : `Pagar R$ ${valor.toFixed(2)} com Pix`}
    </button>
  );
}

function BuscarTurmas({
  jaMatriculadoEm,
  onMatricular,
}: {
  jaMatriculadoEm: Set<number>;
  onMatricular: () => void;
}) {
  const [modalidade, setModalidade] = useState("");
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async (filtro: string) => {
    setLoading(true);
    setErro(null);
    try {
      const query = filtro ? `?modalidade=${encodeURIComponent(filtro)}` : "";
      setTurmas(await api.get<TurmaResumo[]>(`/turmas${query}`));
    } catch {
      setErro("Não foi possível buscar turmas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar("");
  }, [buscar]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    buscar(modalidade);
  }

  const disponiveis = turmas.filter((t) => !jaMatriculadoEm.has(t.id));

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "8px", marginBottom: "16px", maxWidth: "420px" }}
      >
        <input
          placeholder="Filtrar por modalidade (ex.: beach tennis)"
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="secondary">
          Buscar
        </button>
      </form>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Buscando...</p>}

      {!loading && !erro && (
        <>
          {disponiveis.length === 0 ? (
            <p className="empty-state">Nenhuma turma encontrada.</p>
          ) : (
            <div className="card-list">
              {disponiveis.map((t) => (
                <TurmaCard key={t.id} turma={t} onMatricular={onMatricular} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TurmaCard({ turma, onMatricular }: { turma: TurmaResumo; onMatricular: () => void }) {
  const [tipo, setTipo] = useState<MatriculaTipo>("mensal");
  const [fontePagamento, setFontePagamento] = useState<PagamentoMeio>("pix");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function solicitar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/matriculas", { turma_id: turma.id, tipo, fonte_pagamento: fontePagamento });
      setEnviado(true);
      onMatricular();
    } catch {
      setErro("Não foi possível solicitar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">{turma.modalidade}</span>
        <span className="item-card-subtitle">
          {turma.dia_semana} {turma.horario} · {turma.quadra} · {turma.vinculo.point.nome} · com{" "}
          {turma.vinculo.professor.nome}
        </span>
        <span className="item-card-subtitle">
          avulsa R$ {turma.vinculo.preco_avulso.toFixed(2)} · plano R${" "}
          {turma.vinculo.preco_plano.toFixed(2)}
        </span>
        {erro && <p className="form-error">{erro}</p>}
      </div>

      {enviado ? (
        <StatusPill status="em_analise" />
      ) : (
        <div className="item-card-actions">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as MatriculaTipo)}>
            <option value="mensal">Plano mensal</option>
            <option value="avulsa">Aula avulsa</option>
          </select>
          <select
            value={fontePagamento}
            onChange={(e) => setFontePagamento(e.target.value as PagamentoMeio)}
          >
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
          <button disabled={enviando} onClick={solicitar}>
            {enviando ? "Enviando..." : "Solicitar"}
          </button>
        </div>
      )}
    </div>
  );
}
