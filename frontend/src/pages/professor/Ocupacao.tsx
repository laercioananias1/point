import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Matricula, TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { GraficoOcupacao } from "../../components/GraficoOcupacao";

/** Pedido do usuário, 2026-08-26 (mexendo no layout do professor, mesmo
 * padrão do aluno): "ter um botão de Ocupação de turma" (depois renomeado
 * pra "Ocupação de quadra", junto com a versão do admin) — o gráfico que
 * antes ficava embutido direto na Início virou uma tela própria, atrás de
 * um botão, em vez de ocupar espaço fixo na home. */
export default function ProfessorOcupacao() {
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
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
      setErro("Não foi possível carregar seus dados. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/professor")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Ocupação de quadra</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Alunos matriculados sobre a capacidade, só nas minhas quadras e turmas.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && <GraficoOcupacao turmas={turmas} matriculas={matriculas} />}
    </Layout>
  );
}
