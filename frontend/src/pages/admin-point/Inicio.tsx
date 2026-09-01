import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Matricula, Point, TurmaResumo, Vinculo } from "../../api/types";
import { Carrossel } from "../../components/Carrossel";
import { Icon, Layout } from "../../components/Layout";
import { faixaHorario, rotuloDias } from "../../lib/dias";

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
 * nunca saía de zero).
 *
 * Cabeçalho do Point (endereço/horários) + banners + fotos/sobre/
 * informações importantes (pedido do usuário, 2026-09-01: "na tela do adm
 * tb mostra o cabecalho q tem no professor e os dados do point embaixo com
 * as imagens") — mesmo tratamento de professor/Inicio.tsx, só que buscando
 * o Point direto por GET /points/me em vez de via turma (o admin sempre
 * tem point_id, não precisa de uma turma existir pra saber qual Point é). */
export default function AdminPointInicio() {
  const { user } = useAuth();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [point, setPoint] = useState<Point | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, vinculosRes, turmasRes, pointRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Vinculo[]>("/vinculos"),
        user?.point_id
          ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`)
          : Promise.resolve([]),
        api.get<Point>("/points/me"),
      ]);
      setMatriculas(matriculasRes);
      setVinculos(vinculosRes);
      setTurmas(turmasRes);
      setPoint(pointRes);
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
  const temBanners = point !== null && point.banners.length > 0;

  return (
    <Layout>
      <h1>Olá, {primeiroNome}!</h1>
      {point && (
        <section className="section">
          <h2>{point.nome}</h2>
          <p
            className="empty-state"
            style={{ padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            <Icon name="pin" /> {point.endereco}
          </p>
          <p className="empty-state" style={{ padding: 0, marginTop: 2 }}>
            {rotuloDias(point.dias_semana_funcionamento)}:{" "}
            {faixaHorario(point.horarios_semana_funcionamento)}
            {point.dias_fds_funcionamento.length > 0 && (
              <>
                {" "}
                · {rotuloDias(point.dias_fds_funcionamento)}: {faixaHorario(point.horarios_fds_funcionamento)}
              </>
            )}
          </p>
        </section>
      )}

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
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

          {point && temBanners ? (
            <div style={{ marginTop: 16 }}>
              <Carrossel fotos={point.banners} contido />
            </div>
          ) : (
            <section className="section">
              <div className="banner-placeholder">
                <span className="banner-placeholder-icone">📣</span>
                <span>Espaço reservado pra avisos do Point.</span>
              </div>
            </section>
          )}

          {point && (point.fotos.length > 0 || point.sobre || point.informacoes_importantes) && (
            <section className="section">
              {point.fotos.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <Carrossel fotos={point.fotos} />
                </div>
              )}
              {point.sobre && (
                <div style={{ marginTop: 14 }}>
                  <h2>Sobre</h2>
                  <p className="empty-state" style={{ padding: 0, whiteSpace: "pre-wrap" }}>
                    {point.sobre}
                  </p>
                </div>
              )}
              {point.informacoes_importantes && (
                <div style={{ marginTop: 14 }}>
                  <h2>Informações importantes</h2>
                  <p className="empty-state" style={{ padding: 0, whiteSpace: "pre-wrap" }}>
                    {point.informacoes_importantes}
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </Layout>
  );
}
