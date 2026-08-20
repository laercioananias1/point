import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { Credito, Matricula, MatriculaTipo, PagamentoMeio, TurmaResumo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

export default function AlunoDashboard() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [matriculasRes, creditosRes] = await Promise.all([
        api.get<Matricula[]>("/alunos/me/matriculas"),
        api.get<Credito[]>("/alunos/me/creditos"),
      ]);
      setMatriculas(matriculasRes);
      setCreditos(creditosRes);
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
  const creditosDisponiveis = creditos.filter((c) => c.status === "disponivel");

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
              <MatriculaLista matriculas={ativas} onMudanca={carregar} />
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
            <h2>Créditos de reposição ({creditosDisponiveis.length})</h2>
            {creditosDisponiveis.length === 0 ? (
              <p className="empty-state">Nenhum crédito disponível no momento.</p>
            ) : (
              <div className="card-list">
                {creditosDisponiveis.map((c) => (
                  <CreditoRow key={c.id} credito={c} onReagendado={carregar} />
                ))}
              </div>
            )}
          </section>

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
  onMudanca,
}: {
  matriculas: Matricula[];
  onMudanca?: () => void;
}) {
  return (
    <div className="card-list">
      {matriculas.map((m) => (
        <div className="item-card" key={m.id}>
          <div className="item-card-info">
            <span className="item-card-title">{m.turma.modalidade.nome}</span>
            <span className="item-card-subtitle">
              {m.turma.dia_semana} {m.turma.horario} · {m.turma.vinculo.point.nome} · com{" "}
              {m.turma.vinculo.professor.nome} · {m.tipo === "mensal" ? "plano mensal" : "avulsa"}
            </span>
          </div>
          {onMudanca && m.status === "ativa" ? (
            <AcoesMatriculaAtiva matricula={m} onMudanca={onMudanca} />
          ) : (
            <StatusPill status={m.status} />
          )}
        </div>
      ))}
    </div>
  );
}

function AcoesMatriculaAtiva({ matricula, onMudanca }: { matricula: Matricula; onMudanca: () => void }) {
  const jaConfirmado = matricula.pagamentos.some((p) => p.status === "confirmado");
  const [enviando, setEnviando] = useState<"pagar" | "cancelar" | null>(null);

  const valor =
    matricula.tipo === "mensal"
      ? matricula.turma.vinculo.preco_plano
      : matricula.turma.vinculo.preco_avulso;

  async function pagar() {
    setEnviando("pagar");
    try {
      await api.post("/pagamentos", { matricula_id: matricula.id, valor, meio: "pix" });
      onMudanca();
    } finally {
      setEnviando(null);
    }
  }

  async function cancelar() {
    setEnviando("cancelar");
    try {
      await api.patch(`/matriculas/${matricula.id}/cancelar`);
      onMudanca();
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="item-card-actions">
      {jaConfirmado ? (
        <StatusPill status="confirmado" />
      ) : (
        <button disabled={enviando !== null} onClick={pagar}>
          {enviando === "pagar" ? "Pagando..." : `Pagar R$ ${valor.toFixed(2)} com Pix`}
        </button>
      )}
      <button className="secondary" disabled={enviando !== null} onClick={cancelar}>
        {enviando === "cancelar" ? "Cancelando..." : "Cancelar"}
      </button>
    </div>
  );
}

function CreditoRow({ credito, onReagendado }: { credito: Credito; onReagendado: () => void }) {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<TurmaResumo[]>("/turmas").then((res) => {
      setTurmas(res);
      setTurmaId(res[0]?.id ?? null);
    });
  }, []);

  async function reagendar() {
    if (turmaId === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/creditos/${credito.id}/reagendar`, { turma_id: turmaId });
      onReagendado();
    } catch {
      setErro("Não foi possível reagendar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {credito.motivo === "forca_maior" ? "Aula cancelada pelo Point" : "Cancelamento antecipado"}
        </span>
        <span className="item-card-subtitle">
          aula de {credito.data_aula} · válido até {credito.data_expiracao}
        </span>
        {erro && <p className="form-error">{erro}</p>}
      </div>
      <div className="item-card-actions">
        {turmas.length > 0 && (
          <select value={turmaId ?? ""} onChange={(e) => setTurmaId(Number(e.target.value))}>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.modalidade.nome} · {t.dia_semana} {t.horario} · {t.vinculo.point.nome}
              </option>
            ))}
          </select>
        )}
        <button disabled={enviando || turmaId === null} onClick={reagendar}>
          {enviando ? "Reagendando..." : "Reagendar"}
        </button>
      </div>
    </div>
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
        <span className="item-card-title">{turma.modalidade.nome}</span>
        <span className="item-card-subtitle">
          {turma.dia_semana} {turma.horario} ({turma.duracao_minutos} min) · {turma.quadra.nome} ·{" "}
          {turma.vinculo.point.nome} · com{" "}
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
