import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Matricula, TurmaResumo } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { GraficoOcupacao } from "../../components/GraficoOcupacao";

/** Pedido do usuário, 2026-08-26 (mexendo no layout do professor, mesmo
 * padrão do aluno): "ter um botão de Ocupação de turma" (depois renomeado
 * pra "Ocupação de quadra", junto com a versão do admin) — o gráfico que
 * antes ficava embutido direto na Início virou uma tela própria, atrás de
 * um botão, em vez de ocupar espaço fixo na home. */
export default function ProfessorOcupacao() {
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
      <CabecalhoPagina titulo="Ocupação de quadra" contexto="Suas quadras e turmas" />

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && <GraficoOcupacao turmas={turmas} matriculas={matriculas} />}
    </Layout>
  );
}
