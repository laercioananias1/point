import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Matricula, TurmaResumo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { AgendaTurmasCalendario } from "../../components/AgendaTurmasCalendario";

/** Agenda do professor (pedido do usuário, 2026-08-25: "seguindo o mesmo
 * padrão" do aluno — virou aba própria; depois, 2026-08-26: "faça agenda
 * do professor igual agenda do aluno" — mesmo calendário com pontinho por
 * dia em vez da grade hora-a-hora; "mostrar também os alunos e um check
 * pra marcar presença de cada um"). Criar turma e prolongar período ficam
 * na aba Turmas, que é onde essas ações também fazem mais sentido (são
 * por turma, não por data). O calendário em si (pontinhos + ocorrências +
 * presença + remover aula) mora em components/AgendaTurmasCalendario —
 * compartilhado com a Agenda do admin (pedido do usuário, 2026-08-26:
 * "cria o Agenda também [pro admin], igual professor"). */
export default function ProfessorAgenda() {
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  // "pronto" só liga uma vez, no primeiro carregamento — recarregar depois
  // (ex.: após remover uma aula) não pode desmontar o calendário, senão ele
  // perde a visão/posição que o professor tinha escolhido.
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, matriculasRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Matricula[]>("/professores/me/matriculas"),
      ]);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar sua agenda. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <h1>Agenda</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="section">
          <AgendaTurmasCalendario turmas={turmas} matriculas={matriculas} onMudanca={carregar} />
        </section>
      )}
    </Layout>
  );
}
