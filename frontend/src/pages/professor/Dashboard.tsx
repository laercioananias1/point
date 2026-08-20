import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { ModeloRepasse, PointResumo, TurmaResumo, Vinculo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

const MODELOS_REPASSE: { value: ModeloRepasse; label: string }[] = [
  { value: "percentual", label: "Percentual por aula/mensalidade" },
  { value: "valor_fixo_mensal", label: "Valor fixo mensal" },
  { value: "valor_fixo_por_aula", label: "Valor fixo por aula dada" },
];

export default function ProfessorDashboard() {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [points, setPoints] = useState<PointResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [turmasRes, vinculosRes, pointsRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Vinculo[]>("/professores/me/vinculos"),
        api.get<PointResumo[]>("/points/directorio"),
      ]);
      setTurmas(turmasRes);
      setVinculos(vinculosRes);
      setPoints(pointsRes);
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
              <div className="card-list">
                {turmas.map((t) => (
                  <div className="item-card" key={t.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{t.modalidade}</span>
                      <span className="item-card-subtitle">
                        {t.dia_semana} {t.horario} · {t.quadra} · capacidade {t.capacidade}
                      </span>
                    </div>
                  </div>
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
