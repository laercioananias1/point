import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { GraficoOcupacao } from "../../components/GraficoOcupacao";

/** Pedido do usuário, 2026-08-26: "deixe tb 2 botões (iguais do
 * professor) de turma e ocupação de quadra" — mesmo padrão de tela cheia
 * atrás de um botão que já existe pro professor, só que aqui vê o Point
 * inteiro (todas as turmas, de todos os professores), não só as próprias. */
export default function AdminPointOcupacao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      setErro("Não foi possível carregar os dados do Point. Tente novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
        <h1>Ocupação de quadra</h1>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && <GraficoOcupacao turmas={turmas} matriculas={matriculas} />}
    </Layout>
  );
}
