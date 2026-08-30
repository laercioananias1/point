import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, TurmaResumo, Vinculo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Home do admin do Point (pedido do usuário, 2026-08-25/26: "dashboard que
 * mostre tudo que é importante... ele precisa de uma visão geral") — os
 * números que resumem a saúde do Point agora, com link pra aba certa.
 * Gestão de verdade (convidar, aprovar, configurar) fica nas outras abas —
 * aqui é só panorama.
 *
 * Sem estatística de receita/pagamento por enquanto (pedido do usuário,
 * 2026-08-30: "o pagamento pix vai ser automatizado, então por enquanto
 * pode tirar tudo isso. Vamos ter uma api de pix") — volta quando a
 * integração de verdade existir.
 *
 * Sem seção "Pendências" (pedido do usuário, 2026-08-30) — cada item dela
 * já repetia uma lista que existe na própria tela de destino (Convites
 * pendentes e Mensalidades em aberto em Aluno, Convites de vínculo
 * pendentes em Professor); "Matrículas pendentes" nem fazia mais sentido
 * (matrícula avulsa não passa mais por aprovação manual, esse contador
 * nunca saía de zero). */
export default function AdminPointInicio() {
  const { user } = useAuth();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, vinculosRes, turmasRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Vinculo[]>("/vinculos"),
        user?.point_id
          ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`)
          : Promise.resolve([]),
      ]);
      setMatriculas(matriculasRes);
      setVinculos(vinculosRes);
      setTurmas(turmasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os dados do Point. Tente novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const matriculasAtivas = matriculas.filter((m) => m.status === "ativa");
  const mensalidadesEmAtraso = matriculas.filter(
    (m) => m.tipo === "mensal" && m.status === "ativa" && m.inadimplente,
  );
  const vinculosAtivos = vinculos.filter((v) => v.status === "ativo");

  // Alunos ativos = pessoas distintas, não matrículas (um aluno pode ter
  // mais de uma matrícula ativa — mensal em duas turmas, ou mensal + avulsa).
  const alunosAtivos = new Set(matriculasAtivas.map((m) => m.aluno.id)).size;

  const stats = [
    { rotulo: "Alunos ativos", valor: String(alunosAtivos) },
    { rotulo: "Professores ativos", valor: String(vinculosAtivos.length) },
    { rotulo: "Turmas ativas", valor: String(turmas.length) },
    { rotulo: "Em atraso", valor: String(mensalidadesEmAtraso.length) },
  ];

  const primeiroNome = user?.nome.split(" ")[0] ?? "";

  return (
    <Layout>
      <h1>Olá, {primeiroNome}!</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
            <h2>Visão geral</h2>
            <div className="stats-grid">
              {stats.map((s) => (
                <div className="stat-tile" key={s.rotulo}>
                  <div className="stat-label">{s.rotulo}</div>
                  <div className="stat-value">{s.valor}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="quick-actions">
              <Link to="/admin-point/aluno" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="user-check" />
                </span>
                <span className="quick-action-label">Alunos</span>
              </Link>
              <Link to="/admin-point/professor" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="users" />
                </span>
                <span className="quick-action-label">Professores</span>
              </Link>
            </div>
            <div className="quick-actions">
              <Link to="/admin-point/turmas" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="grid" />
                </span>
                <span className="quick-action-label">Turmas</span>
              </Link>
              <Link to="/admin-point/ocupacao" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="chart" />
                </span>
                <span className="quick-action-label">Ocupação de quadra</span>
              </Link>
            </div>
          </section>

          <section className="section">
            <div className="banner-placeholder">
              <span className="banner-placeholder-icone">📣</span>
              <span>Espaço reservado pra avisos do Point.</span>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
