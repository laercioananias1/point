import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type {
  Matricula,
  Modalidade,
  ModeloRepasse,
  PointResumo,
  Quadra,
  TurmaResumo,
  Vinculo,
} from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { Calendar } from "../../components/Calendar";
import { DIAS_SEMANA } from "../../lib/dias";

const MODELOS_REPASSE: { value: ModeloRepasse; label: string }[] = [
  { value: "percentual", label: "Percentual por aula/mensalidade" },
  { value: "valor_fixo_mensal", label: "Valor fixo mensal" },
  { value: "valor_fixo_por_aula", label: "Valor fixo por aula dada" },
];

export default function ProfessorDashboard() {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [points, setPoints] = useState<PointResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [turmasRes, vinculosRes, pointsRes, matriculasRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Vinculo[]>("/professores/me/vinculos"),
        api.get<PointResumo[]>("/points/directorio"),
        api.get<Matricula[]>("/professores/me/matriculas"),
      ]);
      setTurmas(turmasRes);
      setVinculos(vinculosRes);
      setPoints(pointsRes);
      setMatriculas(matriculasRes);
    } catch {
      setErro("Não foi possível carregar seus dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pointsSemVinculo = points.filter(
    (p) => !vinculos.some((v) => v.point_id === p.id && v.status !== "recusado"),
  );
  const vinculosAtivos = vinculos.filter((v) => v.status === "ativo");

  return (
    <Layout>
      <h1>Minhas turmas</h1>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            <h2>Turmas ({turmas.length})</h2>
            {turmas.length === 0 ? (
              <p className="empty-state">
                Nenhuma turma ainda — crie uma dentro de um vínculo ativo.
              </p>
            ) : (
              <Calendar
                items={turmas.map((t) => ({
                  id: t.id,
                  diaSemana: t.dia_semana,
                  horario: t.horario,
                  duracaoMinutos: t.duracao_minutos,
                  periodoInicio: t.periodo_inicio,
                  periodoFim: t.periodo_fim,
                  titulo: t.modalidade.nome,
                  subtitulo: `${t.quadra.nome} · ${t.vinculo.point.nome}`,
                }))}
              />
            )}
          </section>

          <section className="section">
            <h2>Criar turma</h2>
            {vinculosAtivos.length === 0 ? (
              <p className="empty-state">
                Você precisa de um vínculo aprovado por um Point antes de criar turmas.
              </p>
            ) : (
              <CriarTurmaForm vinculos={vinculosAtivos} onCriada={carregar} />
            )}
          </section>

          <section className="section">
            <h2>Matrículas ativas ({matriculas.filter((m) => m.status === "ativa").length})</h2>
            {matriculas.filter((m) => m.status === "ativa").length === 0 ? (
              <p className="empty-state">Nenhuma matrícula ativa nas suas turmas ainda.</p>
            ) : (
              <div className="card-list">
                {matriculas
                  .filter((m) => m.status === "ativa")
                  .map((m) => (
                    <MatriculaPagamentoRow key={m.id} matricula={m} onPago={carregar} />
                  ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Meus vínculos ({vinculos.length})</h2>
            {vinculos.length === 0 ? (
              <p className="empty-state">Você ainda não tem vínculo com nenhum Point.</p>
            ) : (
              <div className="card-list">
                {vinculos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.point.nome}</span>
                      <span className="item-card-subtitle">{v.point.endereco}</span>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Solicitar vínculo</h2>
            {pointsSemVinculo.length === 0 ? (
              <p className="empty-state">
                Você já tem vínculo (ativo ou em análise) com todos os Points cadastrados.
              </p>
            ) : (
              <SolicitarVinculoForm points={pointsSemVinculo} onSucesso={carregar} />
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function MatriculaPagamentoRow({
  matricula,
  onPago,
}: {
  matricula: Matricula;
  onPago: () => void;
}) {
  const jaConfirmado = matricula.pagamentos.some((p) => p.status === "confirmado");
  const valorPadrao =
    matricula.tipo === "mensal" ? matricula.turma.vinculo.preco_plano : matricula.turma.vinculo.preco_avulso;

  const [valor, setValor] = useState(String(valorPadrao));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function lancar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/pagamentos", { matricula_id: matricula.id, valor: Number(valor), meio: "dinheiro" });
      onPago();
    } catch {
      setErro("Não foi possível lançar. Confira o valor e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">{matricula.aluno.nome}</span>
        <span className="item-card-subtitle">
          {matricula.turma.modalidade.nome} · {matricula.tipo === "mensal" ? "plano mensal" : "avulsa"}
        </span>
        {erro && <p className="form-error">{erro}</p>}
      </div>

      {jaConfirmado ? (
        <StatusPill status="confirmado" />
      ) : matricula.fonte_pagamento === "pix" ? (
        <StatusPill status="pendente" />
      ) : (
        <div className="item-card-actions">
          <input
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            style={{ width: "90px" }}
          />
          <button disabled={enviando} onClick={lancar}>
            {enviando ? "Lançando..." : "Lançar em dinheiro"}
          </button>
        </div>
      )}
    </div>
  );
}

// Horas cheias disponíveis pra seleção — cobre a janela típica de
// funcionamento de uma arena (manhã cedo até o fim da noite).
const HORAS_DISPONIVEIS = Array.from({ length: 19 }, (_, i) => i + 5); // 5h..23h

function toggleEmLista<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function daquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function CriarTurmaForm({
  vinculos,
  onCriada,
}: {
  vinculos: Vinculo[];
  onCriada: () => void;
}) {
  const [vinculoId, setVinculoId] = useState(vinculos[0]?.id ?? 0);
  const pointId = vinculos.find((v) => v.id === vinculoId)?.point_id ?? 0;

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeId, setModalidadeId] = useState<number | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<number | null>(null);

  const [capacidade, setCapacidade] = useState("4");
  const [duracaoMinutos, setDuracaoMinutos] = useState("60");
  const [periodoInicio, setPeriodoInicio] = useState(hoje());
  const [periodoFim, setPeriodoFim] = useState(daquiA(90));
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<number[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!pointId) return;
    api.get<Modalidade[]>(`/modalidades?point_id=${pointId}`).then((res) => {
      setModalidades(res);
      setModalidadeId(res[0]?.id ?? null);
    });
  }, [pointId]);

  useEffect(() => {
    const modalidade = modalidades.find((m) => m.id === modalidadeId);
    if (modalidade) setDuracaoMinutos(String(modalidade.duracao_padrao_minutos));

    if (!pointId || modalidadeId === null) {
      setQuadras([]);
      setQuadraId(null);
      return;
    }
    api.get<Quadra[]>(`/quadras?point_id=${pointId}&modalidade_id=${modalidadeId}`).then((res) => {
      setQuadras(res);
      setQuadraId(res[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, modalidadeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (modalidadeId === null || quadraId === null) return;
    if (diasSemana.length === 0 || horarios.length === 0) {
      setErro("Escolha pelo menos um dia e um horário.");
      return;
    }
    if (periodoInicio > periodoFim) {
      setErro("O início do período precisa ser antes do fim.");
      return;
    }

    setEnviando(true);
    try {
      const turmasCriadas = await api.post<unknown[]>("/turmas", {
        vinculo_id: vinculoId,
        modalidade_id: modalidadeId,
        quadra_id: quadraId,
        capacidade: Number(capacidade),
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        dias_semana: diasSemana,
        horarios: horarios.map((h) => `${String(h).padStart(2, "0")}:00`),
        duracao_minutos: Number(duracaoMinutos),
        recorrencia: "semanal",
      });
      setSucesso(
        turmasCriadas.length === 1
          ? "1 turma criada."
          : `${turmasCriadas.length} turmas criadas (${diasSemana.length} dia(s) × ${horarios.length} horário(s)).`,
      );
      setDiasSemana([]);
      setHorarios([]);
      onCriada();
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível criar a turma. Confira os valores e tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (modalidades.length === 0) {
    return (
      <p className="empty-state">
        Nenhuma modalidade cadastrada nesse Point ainda — peça pro admin cadastrar
        modalidades e quadras antes.
      </p>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {vinculos.length > 1 && (
        <label>
          Point
          <select value={vinculoId} onChange={(e) => setVinculoId(Number(e.target.value))}>
            {vinculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.point.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Modalidade
        <select
          value={modalidadeId ?? ""}
          onChange={(e) => setModalidadeId(Number(e.target.value))}
        >
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      {quadras.length === 0 ? (
        <p className="empty-state" style={{ padding: 0 }}>
          Nenhuma quadra cadastrada pra essa modalidade — peça pro admin associar uma.
        </p>
      ) : (
        <div className="form-row">
          <label>
            Quadra
            <select value={quadraId ?? ""} onChange={(e) => setQuadraId(Number(e.target.value))}>
              {quadras.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacidade
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              required
            />
          </label>
        </div>
      )}

      <label>
        Duração da aula (min)
        <input
          type="number"
          min="15"
          step="15"
          value={duracaoMinutos}
          onChange={(e) => setDuracaoMinutos(e.target.value)}
          required
        />
      </label>

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

      <label>
        Dias da semana
        <div className="toggle-grid">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.value}
              type="button"
              className={diasSemana.includes(d.value) ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setDiasSemana((atual) => toggleEmLista(atual, d.value))}
            >
              {d.label}
            </button>
          ))}
        </div>
      </label>

      <label>
        Horários (hora cheia)
        <div className="toggle-grid">
          {HORAS_DISPONIVEIS.map((h) => (
            <button
              key={h}
              type="button"
              className={horarios.includes(h) ? "toggle-chip active" : "toggle-chip"}
              onClick={() => setHorarios((atual) => toggleEmLista(atual, h))}
            >
              {h}h
            </button>
          ))}
        </div>
      </label>

      <p className="empty-state" style={{ padding: 0 }}>
        Cria uma turma pra cada combinação de dia e horário marcados acima.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">{sucesso}</p>}

      <button type="submit" disabled={enviando || quadras.length === 0}>
        {enviando ? "Criando..." : "Criar turma(s)"}
      </button>
    </form>
  );
}

function SolicitarVinculoForm({
  points,
  onSucesso,
}: {
  points: PointResumo[];
  onSucesso: () => void;
}) {
  const [pointId, setPointId] = useState(points[0]?.id ?? 0);
  const [precoAvulso, setPrecoAvulso] = useState("");
  const [precoPlano, setPrecoPlano] = useState("");
  const [modeloRepasse, setModeloRepasse] = useState<ModeloRepasse>("percentual");
  const [valorRepasse, setValorRepasse] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setEnviando(true);
    try {
      await api.post("/vinculos", {
        point_id: pointId,
        preco_avulso: Number(precoAvulso),
        preco_plano: Number(precoPlano),
        modelo_repasse: modeloRepasse,
        valor_repasse: Number(valorRepasse),
      });
      setSucesso(true);
      setPrecoAvulso("");
      setPrecoPlano("");
      setValorRepasse("");
      onSucesso();
    } catch {
      setErro("Não foi possível enviar a solicitação. Confira os valores e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <label>
        Point
        <select value={pointId} onChange={(e) => setPointId(Number(e.target.value))}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label>
          Preço da aula avulsa (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={precoAvulso}
            onChange={(e) => setPrecoAvulso(e.target.value)}
            required
          />
        </label>
        <label>
          Preço do plano mensal (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={precoPlano}
            onChange={(e) => setPrecoPlano(e.target.value)}
            required
          />
        </label>
      </div>

      <label>
        Modelo de repasse proposto
        <select
          value={modeloRepasse}
          onChange={(e) => setModeloRepasse(e.target.value as ModeloRepasse)}
        >
          {MODELOS_REPASSE.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        {modeloRepasse === "percentual" ? "Percentual (%)" : "Valor (R$)"}
        <input
          type="number"
          min="0"
          step="0.01"
          value={valorRepasse}
          onChange={(e) => setValorRepasse(e.target.value)}
          required
        />
      </label>

      <p className="empty-state" style={{ padding: 0 }}>
        O admin do Point pode ajustar esses valores antes de aprovar.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">Solicitação enviada — aguardando aprovação.</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Solicitar vínculo"}
      </button>
    </form>
  );
}
