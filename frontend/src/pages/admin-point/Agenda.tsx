import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, TurmaResumo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { AgendaTurmasCalendario } from "../../components/AgendaTurmasCalendario";

/** Agenda do admin (pedido do usuário, 2026-08-26: "cria o Agenda também
 * [na barra inferior], igual professor. e insere o filtro de
 * professores") — mesmo calendário compartilhado (components/
 * AgendaTurmasCalendario), só que com o Point inteiro (todas as turmas,
 * de todos os professores) e um filtro pra restringir a um só. */
export default function AdminPointAgenda() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Filtros por professor e por quadra (pedido do usuário, 2026-08-26) —
  // "" = todos, os dois podem estar ativos ao mesmo tempo.
  const [professorId, setProfessorId] = useState("");
  const [quadraId, setQuadraId] = useState("");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, matriculasRes] = await Promise.all([
        user?.point_id
          ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`)
          : Promise.resolve([]),
        api.get<Matricula[]>("/matriculas"),
      ]);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar a agenda do Point. Tente novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Lista de professores/quadras só com quem tem turma nesse Point, sem
  // repetir (mesmo padrão do filtro em Turmas).
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
      <h1>Agenda</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="section">
          {turmas.length > 0 && (
            <div className="form-row" style={{ marginBottom: 16 }}>
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
          )}

          <AgendaTurmasCalendario turmas={turmasFiltradas} matriculas={matriculas} onMudanca={carregar} />
        </section>
      )}
    </Layout>
  );
}
