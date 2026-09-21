import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, SolicitacaoExperimental, TurmaResumo, Vinculo } from "../../api/types";
import { AgendaTurmasCalendario } from "../../components/AgendaTurmasCalendario";
import { Avatar } from "../../components/Avatar";
import { Icon, Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

/** Agenda de um professor específico, do lado do admin (pedido do usuário,
 * 2026-09-08: "faca uma tela de edicao do professor, da mesma forma q é do
 * aluno. ver o calendario") — mesmo padrão de AgendaAluno.tsx: tela de
 * DETALHE (não edita nome/contato/e-mail, que continuam sendo dados do
 * próprio professor), aberta ao clicar no professor da lista, mostrando o
 * calendário das turmas dele nesse Point — mesmo componente
 * AgendaTurmasCalendario já usado na Agenda geral do admin, só que
 * filtrado pra esse professor. */
export default function AdminPointAgendaProfessor() {
  const { professorId } = useParams<{ professorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [solicitacoesExperimentais, setSolicitacoesExperimentais] = useState<
    SolicitacaoExperimental[]
  >([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [vinculosRes, turmasRes, matriculasRes, experimentaisRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        user?.point_id
          ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`)
          : Promise.resolve([]),
        api.get<Matricula[]>("/matriculas"),
        api.get<SolicitacaoExperimental[]>("/experimental/solicitacoes?status=aprovada"),
      ]);
      setVinculos(vinculosRes);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setSolicitacoesExperimentais(experimentaisRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar a agenda desse professor. Tente novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idProfessor = Number(professorId);
  const vinculo = vinculos.find((v) => v.professor.id === idProfessor) ?? null;
  const turmasDoProfessor = turmas.filter((t) => t.vinculo.professor.id === idProfessor);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/professor")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Agenda {vinculo && `— ${vinculo.professor.nome}`}</h1>
      </div>

      {vinculo && (
        <div className="agenda-pessoa">
          <Avatar nome={vinculo.professor.nome} foto={vinculo.professor.foto} tamanho={56} />
          <p className="empty-state" style={{ padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {vinculo.professor.contato} · {vinculo.professor.email}
            <StatusPill status={vinculo.status} />
          </p>
        </div>
      )}

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="section">
          {turmasDoProfessor.length === 0 ? (
            <p className="empty-state">Esse professor não tem turma cadastrada nesse Point ainda.</p>
          ) : (
            <AgendaTurmasCalendario
              turmas={turmasDoProfessor}
              matriculas={matriculas}
              solicitacoesExperimentais={solicitacoesExperimentais}
              onMudanca={carregar}
            />
          )}
        </section>
      )}
    </Layout>
  );
}
