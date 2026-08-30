import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Credito, Matricula } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Icon, Layout } from "../../components/Layout";
import { proximasOcorrencias, type CalendarItem } from "../../components/Calendar";
import { Carrossel } from "../../components/Carrossel";
import { faixaHorario, rotuloDias } from "../../lib/dias";

const QUANTIDADE_PROXIMOS = 5;

/** Home do aluno (pedido do usuário, 2026-08-26: "vamos deixar parecida
 * com essa" — referência de app de academia: saudação + Point, 2 atalhos
 * em caixinha, espaço reservado pra banner, próximas aulas embaixo).
 * "Ver agenda completa" continua levando pro calendário de verdade (aba
 * Agenda), que segue com todas as ações (pagar, cancelar, comprar
 * avulsa) — aqui é só visão rápida + atalhos. */
export default function AlunoInicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, creditosRes] = await Promise.all([
        api.get<Matricula[]>("/alunos/me/matriculas"),
        api.get<Credito[]>("/alunos/me/creditos"),
      ]);
      setMatriculas(matriculasRes);
      setCreditos(creditosRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar sua agenda. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ativas = matriculas.filter((m) => m.status === "ativa");
  const mensaisAtivas = ativas.filter((m) => m.tipo === "mensal");
  const creditosDisponiveis = creditos.filter((c) => c.status === "disponivel");
  const emAtraso = mensaisAtivas.filter((m) => m.inadimplente);
  const aguardandoConfirmacao = mensaisAtivas.filter((m) => m.pagamento_pendente_atual);
  // Point(s) onde o aluno treina, pra mostrar embaixo do nome (pedido do
  // usuário) — quase sempre só um, mas não trava se algum dia tiver mais.
  const pointsNomes = Array.from(new Set(ativas.map((m) => m.turma.vinculo.point.nome)));
  // Perfil do Point (pedido do usuário, 2026-08-30) — usa o Point da
  // primeira matrícula ativa. Anúncios preenche o banner do meio da
  // página (pedido do usuário, 2026-08-30: "na parte do meio vai colocar
  // anúncios"); sem anúncio cadastrado, cai no banner-placeholder de
  // sempre. Endereço/horários/fotos/Sobre/Informações importantes formam
  // um bloco à parte, no fim da página (depois de "Próximas aulas" —
  // pedido do usuário, 2026-08-30: "no caso de alunos depois das
  // próximas aulas" / "mostre o endereço e horários de funcionamento tb
  // na tela inicial").
  const point = ativas[0]?.turma.vinculo.point ?? null;
  // Anúncios viraram só imagem (pedido do usuário, 2026-08-30: "anúncios
  // será imagens também, como banners" — depois "retira o texto de
  // anúncio": o campo de texto saiu do Meu Point, banner em carrossel é
  // o único jeito de preencher esse espaço agora).
  const temBanners = point !== null && point.banners.length > 0;

  const calendarItems: CalendarItem[] = mensaisAtivas.flatMap((m) =>
    m.dias_semana.map((dia) => ({
      id: m.id,
      diaSemana: dia,
      horario: m.turma.horario,
      duracaoMinutos: m.turma.duracao_minutos,
      periodoInicio: m.data_inicio_efetiva,
      periodoFim: m.turma.periodo_fim,
      excecoes: [...m.turma.excecoes, ...m.excecoes],
      titulo: m.turma.modalidade.nome,
      subtitulo: `${m.turma.quadra.nome} · ${m.turma.vinculo.point.nome}`,
    })),
  );
  const proximos = proximasOcorrencias(calendarItems, new Date(), QUANTIDADE_PROXIMOS);

  const primeiroNome = user?.nome.split(" ")[0] ?? "";

  // "Agendar" é o atalho pra USAR um crédito (pedido do usuário,
  // 2026-08-26: "não precisa listar os créditos, abre automaticamente a
  // tela e utilize o crédito que tiver mais antigo") — nunca passa pela
  // lista: some direto pro reagendamento do crédito mais antigo (aula
  // original mais antiga primeiro, é o que mais perto está de vencer).
  // Sem nenhum crédito disponível, abre a tela "Novo agendamento" (pedido
  // do usuário, 2026-08-26: "abre uma tela parecida com essa... se não
  // tiver crédito deixa um botão de comprar aula avulsa").
  function irParaAgendar() {
    if (creditosDisponiveis.length === 0) {
      navigate("/aluno/agendar");
      return;
    }
    const maisAntigo = [...creditosDisponiveis].sort(
      (a, b) => a.data_aula.localeCompare(b.data_aula) || a.id - b.id,
    )[0];
    navigate(`/aluno/creditos/${maisAntigo.id}/reagendar`);
  }

  return (
    <Layout>
      <h1>Olá, {primeiroNome}!</h1>
      {pointsNomes.length > 0 && (
        <p className="empty-state" style={{ padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" /> {pointsNomes.join(" · ")}
        </p>
      )}

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          {emAtraso.length > 0 && (
            <p className="form-error" style={{ marginTop: 4 }}>
              Você tem {emAtraso.length === 1 ? "uma mensalidade" : `${emAtraso.length} mensalidades`}{" "}
              em atraso — novas aulas não são geradas até regularizar. Veja em Agenda.
            </p>
          )}
          {aguardandoConfirmacao.length > 0 && (
            <p className="empty-state" style={{ paddingTop: 4 }}>
              {aguardandoConfirmacao.length === 1
                ? "Um pagamento está"
                : `${aguardandoConfirmacao.length} pagamentos estão`}{" "}
              aguardando confirmação do Point.
            </p>
          )}

          <div className="quick-actions" style={{ marginTop: 16 }}>
            <button type="button" className="quick-action" onClick={irParaAgendar}>
              <span className="quick-action-icon">
                <Icon name="calendar" />
              </span>
              <span className="quick-action-label">Agendar</span>
            </button>
            <button type="button" className="quick-action" onClick={() => navigate("/aluno/creditos")}>
              <span className="quick-action-icon">
                <Icon name="ticket" />
              </span>
              <span className="quick-action-label">
                Meus créditos{creditosDisponiveis.length > 0 ? ` (${creditosDisponiveis.length})` : ""}
              </span>
            </button>
          </div>

          {point && temBanners ? (
            <div style={{ marginTop: 16 }}>
              <Carrossel fotos={point.banners} contido />
            </div>
          ) : (
            <div className="banner-placeholder" style={{ marginTop: 16 }}>
              <span className="banner-placeholder-icone">📣</span>
              <span>Espaço reservado pra novidades e eventos do Point.</span>
            </div>
          )}

          <section className="section">
            <h2>Próximas aulas</h2>
            {mensaisAtivas.length === 0 ? (
              <p className="empty-state">
                Nenhum plano mensal ativo ainda — suas próximas aulas aparecem aqui assim que você
                tiver um.
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
              onClick={() => navigate("/aluno/agenda")}
            >
              Ver agenda completa →
            </button>
          </section>

          {point && (
            <section className="section">
              <h2>Endereço e horários</h2>
              <p className="empty-state" style={{ padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="pin" /> {point.endereco}
              </p>
              <p className="empty-state" style={{ padding: 0, marginTop: 2 }}>
                {rotuloDias(point.dias_semana_funcionamento)}:{" "}
                {faixaHorario(point.horarios_semana_funcionamento)}
                {point.dias_fds_funcionamento.length > 0 && (
                  <>
                    {" "}
                    · {rotuloDias(point.dias_fds_funcionamento)}:{" "}
                    {faixaHorario(point.horarios_fds_funcionamento)}
                  </>
                )}
              </p>

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
