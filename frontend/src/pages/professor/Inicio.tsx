import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { TurmaResumo } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Carrossel } from "../../components/Carrossel";
import { Icon, Layout } from "../../components/Layout";
import { proximasOcorrencias, type CalendarItem } from "../../components/Calendar";
import { faixaHorario, rotuloDias } from "../../lib/dias";

const QUANTIDADE_PROXIMOS = 5;

/** Home do professor (pedido do usuário, 2026-08-25: "seguindo o mesmo
 * padrão" do aluno) — visão rápida das próximas aulas, sem abrir a agenda
 * inteira; "Ver agenda completa" leva pra aba Agenda.
 *
 * Banners e dados do Point (pedido do usuário, 2026-08-30: "perfil de
 * professor e adm tb aparece os banners. Na de professor aparece tb os
 * dados do point" — depois, vendo o placeholder ainda vazio na própria
 * Início: "isso q ta aparecendo") — mesmo tratamento já dado à Início do
 * aluno: banners preenchem o espaço reservado do meio, e o resto (fotos,
 * sobre, endereço, horários) fica num bloco no fim da página. Usa o
 * Point da primeira turma (mesmo critério de pointsNomes acima). */
export default function ProfessorInicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setTurmas(await api.get<TurmaResumo[]>("/professores/me/turmas"));
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar seus dados. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const calendarItems: CalendarItem[] = turmas.flatMap((t) =>
    t.dias_semana.map((dia) => ({
      id: t.id,
      diaSemana: dia,
      horario: t.horario,
      duracaoMinutos: t.duracao_minutos,
      periodoInicio: t.periodo_inicio,
      periodoFim: t.periodo_fim,
      excecoes: t.excecoes,
      titulo: t.modalidade.nome,
      subtitulo: `${t.quadra.nome} · ${t.vinculo.point.nome}`,
    })),
  );
  const proximos = proximasOcorrencias(calendarItems, new Date(), QUANTIDADE_PROXIMOS);

  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  const point = turmas[0]?.vinculo.point ?? null;
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
            <div className="quick-actions">
              <Link to="/professor/turmas" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="grid" />
                </span>
                <span className="quick-action-label">Turmas</span>
              </Link>
              <Link to="/professor/ocupacao" className="quick-action">
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

          <section className="section">
            <h2>Próximos agendamentos</h2>
            {turmas.length === 0 ? (
              <p className="empty-state">
                Nenhuma turma ainda — crie uma na aba Turmas.
              </p>
            ) : proximos.length === 0 ? (
              <p className="empty-state">Nenhuma aula agendada nos próximos meses.</p>
            ) : (
              <div className="card-list">
                {proximos.map(({ item, data }, i) => (
                  <div className="item-card" key={`${item.id}-${i}`}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {data
                          .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
                          .replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      <span className="item-card-subtitle">
                        {item.horario} · {item.titulo} · {item.subtitulo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="link-btn"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/professor/agenda")}
            >
              Ver agenda completa →
            </button>
          </section>

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
