import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { rotuloTurma } from "../../lib/dias";

function rotuloPeriodo(inicio: string, fim: string | null): string {
  const data = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("pt-BR");
  return fim === null ? `desde ${data(inicio)} · recorrente` : `${data(inicio)} – ${data(fim)}`;
}

/** Pedido do usuário, 2026-08-26: "deixe tb 2 botões (iguais do
 * professor) de turma e ocupação de quadra" — aqui é o Point inteiro
 * (todas as turmas, de todos os professores), só leitura: quem cria e
 * prolonga turma continua sendo o professor dono dela (aba Turmas dele),
 * o admin só acompanha. */
export default function AdminPointTurmas() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Turmas {pronto && `(${turmasFiltradas.length})`}</h1>
      </div>

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
                    <div className="item-card" key={t.id}>
                      <div className="item-card-info">
                        <span className="item-card-title">{rotuloTurma(t.dias_semana, t.horario)}</span>
                        <span className="item-card-subtitle">
                          {t.modalidade.nome} · {t.quadra.nome} · com {t.vinculo.professor.nome} ·{" "}
                          {t.capacidade} vaga(s)
                        </span>
                        <span className="item-card-subtitle">
                          {rotuloPeriodo(t.periodo_inicio, t.periodo_fim)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </Layout>
  );
}
