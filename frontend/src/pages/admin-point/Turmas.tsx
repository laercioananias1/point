import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { ExperimentalConfig, TurmaResumo } from "../../api/types";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { Icon, Layout } from "../../components/Layout";
import { rotuloTurma } from "../../lib/dias";

function rotuloPeriodo(inicio: string, fim: string | null): string {
  const data = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("pt-BR");
  return fim === null ? `desde ${data(inicio)} · recorrente` : `${data(inicio)} – ${data(fim)}`;
}

function TurmaLinha({ turma: t, onAtualizada }: { turma: TurmaResumo; onAtualizada: () => void }) {
  const [salvando, setSalvando] = useState(false);

  async function mudarAulaExperimental(valor: ExperimentalConfig) {
    setSalvando(true);
    try {
      await api.patch(`/turmas/${t.id}/aula-experimental`, { aula_experimental: valor });
      onAtualizada();
    } catch {
      // Select simples — sem tratamento de erro dedicado; falha só deixa o
      // valor antigo até a próxima recarga.
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {rotuloTurma(t.dias_semana, t.horario)}
          {t.privada && (
            <span className="status-pill status-info" style={{ marginLeft: 8 }}>
              Privada
            </span>
          )}
          {t.aula_experimental !== "nao" && (
            <span className="status-pill status-good" style={{ marginLeft: 8 }}>
              {t.aula_experimental === "somente" ? "Só experimental" : "Aceita experimental"}
            </span>
          )}
        </span>
        <span className="item-card-subtitle">
          <CategoriaBadge nome={t.categoria.nome} cor={t.categoria.cor} /> · {t.tipo_turma.nome}
        </span>
        <span className="item-card-subtitle">
          {t.modalidade.nome} · {t.quadra.nome} · com {t.vinculo.professor.nome} · {t.capacidade} vaga(s)
        </span>
        <span className="item-card-subtitle">{rotuloPeriodo(t.periodo_inicio, t.periodo_fim)}</span>
        <label style={{ marginTop: 4 }}>
          Aula experimental
          <select
            value={t.aula_experimental}
            disabled={salvando}
            onChange={(e) => mudarAulaExperimental(e.target.value as ExperimentalConfig)}
          >
            <option value="nao">Não participa</option>
            <option value="aceita">Aceita (vaga livre pra visitante)</option>
            <option value="somente">Somente experimental</option>
          </select>
        </label>
      </div>
    </div>
  );
}

/** Pedido do usuário, 2026-08-26: "deixe tb 2 botões (iguais do
 * professor) de turma e ocupação de quadra" — aqui é o Point inteiro
 * (todas as turmas, de todos os professores). Prolongar período continua
 * exclusivo do professor dono da turma (aba Turmas dele); criar turma o
 * admin também pode, em nome de qualquer professor vinculado ao seu Point
 * (pedido do usuário, 2026-09-09: "o adm tb pode criar turmas porém
 * precisa selecionar o professor" — ver admin-point/CadastrarTurma.tsx). */
export default function AdminPointTurmas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Filtros por professor e por quadra (pedido do usuário, 2026-08-26) —
  // "" = todos, os dois podem estar ativos ao mesmo tempo.
  const [professorId, setProfessorId] = useState("");
  const [quadraId, setQuadraId] = useState("");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setTurmas(
        user?.point_id ? await api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`) : [],
      );
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar as turmas. Tente novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Lista de professores/quadras só com quem tem turma nesse Point, sem
  // repetir (pedido do usuário, 2026-08-26: "a turma pode colocar um
  // filtro por professor" / "coloca tb o filtro de quadra em turmas").
  const professores = Array.from(
    new Map(turmas.map((t) => [t.vinculo.professor.id, t.vinculo.professor])).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome));
  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values()).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
  const turmasFiltradas = turmas.filter((t) => {
    if (professorId && t.vinculo.professor.id !== Number(professorId)) return false;
    if (quadraId && t.quadra.id !== Number(quadraId)) return false;
    return true;
  });

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
        <h1>Turmas {pronto && `(${turmasFiltradas.length})`}</h1>
      </div>

      {criada && <p className="form-success">{criada}</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="section">
          {turmas.length === 0 ? (
            <p className="empty-state">Nenhuma turma cadastrada nesse Point ainda.</p>
          ) : (
            <>
              <div className="form-row">
                <label className="filter-label">
                  Filtrar por professor
                  <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
                    <option value="">Todos os professores</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-label">
                  Filtrar por quadra
                  <select value={quadraId} onChange={(e) => setQuadraId(e.target.value)}>
                    <option value="">Todas as quadras</option>
                    {quadras.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {turmasFiltradas.length === 0 ? (
                <p className="empty-state">Nenhuma turma encontrada com esse filtro.</p>
              ) : (
                <div className="card-list" style={{ marginTop: 12 }}>
                  {turmasFiltradas.map((t) => (
                    <TurmaLinha key={t.id} turma={t} onAtualizada={carregar} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {pronto && (
        <section className="section">
          <Link to="/admin-point/turmas/cadastrar" className="action-card">
            <span className="action-card-icon">
              <Icon name="plus" />
            </span>
            <span className="action-card-info">
              <span className="action-card-title">Criar turma</span>
              <span className="action-card-subtitle">Em nome de qualquer professor vinculado a este Point</span>
            </span>
            <span className="action-card-chevron" aria-hidden="true">
              <Icon name="chevron-right" />
            </span>
          </Link>
        </section>
      )}
    </Layout>
  );
}
