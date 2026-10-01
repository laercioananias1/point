import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Credito, Matricula, SaldoCheckinsAluno } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Icon, Layout } from "../../components/Layout";
import { proximasOcorrencias, type CalendarItem } from "../../components/Calendar";
import { AvisosDoPoint, CartaoDoPoint } from "../../components/PointNoInicio";

const QUANTIDADE_PROXIMOS = 5;

const NOME_PLATAFORMA: Record<string, string> = { wellhub: "Wellhub", totalpass: "TotalPass" };

function nomePlataforma(plataforma: string) {
  return NOME_PLATAFORMA[plataforma] ?? plataforma;
}

function plural(n: number, singular: string, pluralForma: string) {
  return n === 1 ? singular : pluralForma;
}

/** Texto do card de saldo — mesma regra da tela do protótipo
 * (design/telas/CheckinsAluno.dc.html). */
function textoSaldo(saldo: number) {
  if (saldo < 0) {
    const falta = -saldo;
    return {
      titulo: `${plural(falta, "Falta", "Faltam")} ${falta} ${plural(falta, "check-in", "check-ins")}`,
      sub: "para empatar com as aulas que você já fez",
    };
  }
  if (saldo === 0) return { titulo: "Tudo em dia", sub: "Check-ins iguais às aulas até hoje" };
  return {
    titulo: "Você está adiantado",
    sub: `${saldo} ${plural(saldo, "check-in", "check-ins")} a mais que as aulas até hoje`,
  };
}

function dataPorExtenso(data: Date) {
  return data
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Home do aluno (pedido do usuário, 2026-08-26: saudação + Point, 2
 * atalhos, espaço de banner, próximas aulas embaixo). Layout do kit de
 * design (pedido do usuário, 2026-10-01): cabeçalho escuro com a próxima
 * aula — ou, pra quem paga por Wellhub/TotalPass, o saldo de check-ins do
 * mês (aulas × check-ins, mesma conta do acerto do admin). "Ver agenda
 * completa" continua levando pro calendário de verdade (aba Agenda), que
 * segue com todas as ações (pagar, cancelar, comprar avulsa). */
export default function AlunoInicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [saldos, setSaldos] = useState<SaldoCheckinsAluno[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, creditosRes, saldosRes] = await Promise.all([
        api.get<Matricula[]>("/alunos/me/matriculas"),
        api.get<Credito[]>("/alunos/me/creditos"),
        // Saldo é complemento — se falhar, a home segue sem o card.
        api.get<SaldoCheckinsAluno[]>("/wellhub/meu-saldo").catch(() => []),
      ]);
      setMatriculas(matriculasRes);
      setCreditos(creditosRes);
      setSaldos(saldosRes);
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
  // Point(s) onde o aluno treina — quase sempre só um, mas não trava se
  // algum dia tiver mais.
  const pointsNomes = Array.from(new Set(ativas.map((m) => m.turma.vinculo.point.nome)));
  // Perfil do Point (pedido do usuário, 2026-08-30) — usa o Point da
  // primeira matrícula ativa: banners no meio da página, endereço/
  // horários/fotos/Sobre/Informações importantes no fim.
  const point = ativas[0]?.turma.vinculo.point ?? null;
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
  const proxima = proximos[0] ?? null;

  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  const hoje = new Date();
  const mesAtual = hoje
    .toLocaleDateString("pt-BR", { month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const plataformas = Array.from(new Set(saldos.map((s) => nomePlataforma(s.plataforma))));
  const variosPoints = new Set(saldos.map((s) => s.point_id)).size > 1;

  // "Agendar" é o atalho pra USAR um crédito (pedido do usuário,
  // 2026-08-26: "não precisa listar os créditos, abre automaticamente a
  // tela e utilize o crédito que tiver mais antigo") — some direto pro
  // reagendamento do crédito mais antigo. Sem crédito disponível, abre a
  // tela "Novo agendamento" (com o botão de comprar aula avulsa).
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
      <section className="aluno-hero">
        <div className="aluno-hero-topo">
          {pointsNomes.length > 0 && (
            <span className="aluno-hero-contexto">
              <Icon name="pin" size={16} /> {pointsNomes.join(" · ")}
              {plataformas.length > 0 && ` · ${plataformas.join(" · ")} · ${mesAtual}`}
            </span>
          )}
          <h1>Olá, {primeiroNome}!</h1>
        </div>

        {pronto && saldos.length > 0 &&
          saldos.map((s) => {
            const texto = textoSaldo(s.saldo);
            const classe = s.saldo < 0 ? "falta" : s.saldo === 0 ? "em-dia" : "adiantado";
            return (
              <div className="aluno-saldo" key={`${s.point_id}-${s.plataforma}`}>
                {(saldos.length > 1 || variosPoints) && (
                  <span className="aluno-saldo-grupo">
                    {nomePlataforma(s.plataforma)}
                    {variosPoints && ` · ${s.point_nome}`}
                  </span>
                )}
                <div className="aluno-stats">
                  <div className="aluno-stat">
                    <span className="aluno-stat-rotulo">Aulas no mês</span>
                    <span className="aluno-stat-valor">{s.aulas}</span>
                  </div>
                  <div className="aluno-stat">
                    <span className="aluno-stat-rotulo">Check-ins no mês</span>
                    <span className="aluno-stat-valor limao">{s.checkins}</span>
                  </div>
                </div>
                <div className={`aluno-saldo-card ${classe}`}>
                  <div>
                    <div className="aluno-saldo-titulo">{texto.titulo}</div>
                    <div className="aluno-saldo-sub">{texto.sub}</div>
                  </div>
                  <span className="aluno-saldo-numero">{s.saldo > 0 ? `+${s.saldo}` : s.saldo}</span>
                </div>
              </div>
            );
          })}

        {pronto && saldos.length === 0 && (
          <div className="aluno-proxima">
            <span className="aluno-stat-rotulo">Próxima aula</span>
            {proxima ? (
              <>
                <span className="aluno-proxima-hora">{proxima.item.horario}</span>
                <span className="aluno-proxima-texto">
                  {dataPorExtenso(proxima.data)} · {proxima.item.titulo}
                </span>
                <span className="aluno-proxima-sub">{proxima.item.subtitulo}</span>
              </>
            ) : (
              <span className="aluno-proxima-texto">Nenhuma aula agendada por enquanto.</span>
            )}
          </div>
        )}
      </section>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <div className="aluno-corpo">
          {(emAtraso.length > 0 || aguardandoConfirmacao.length > 0) && (
            <div className="inicio-pendencias">
              {emAtraso.length > 0 && (
                <Link to="/aluno/agenda" className="inicio-pendencia">
                  {emAtraso.length === 1
                    ? "Uma mensalidade em atraso"
                    : `${emAtraso.length} mensalidades em atraso`}{" "}
                  — novas aulas só depois de regularizar
                  <Icon name="chevron-right" size={16} />
                </Link>
              )}
              {aguardandoConfirmacao.length > 0 && (
                <span className="inicio-pendencia ok">
                  <Icon name="clock" size={16} />
                  {aguardandoConfirmacao.length === 1
                    ? "Um pagamento aguardando"
                    : `${aguardandoConfirmacao.length} pagamentos aguardando`}{" "}
                  confirmação do Point
                </span>
              )}
            </div>
          )}

          <div className="aluno-atalhos">
            <button type="button" className="aluno-atalho principal" onClick={irParaAgendar}>
              <span className="aluno-atalho-icone">
                <Icon name="calendar" />
              </span>
              <span className="aluno-atalho-texto">
                <strong>Agendar</strong>
                <span>
                  {creditosDisponiveis.length > 0 ? "Usar meu crédito mais antigo" : "Marcar uma aula"}
                </span>
              </span>
            </button>
            <button type="button" className="aluno-atalho" onClick={() => navigate("/aluno/creditos")}>
              <span className="aluno-atalho-icone">
                <Icon name="ticket" />
              </span>
              <span className="aluno-atalho-texto">
                <strong>Meus créditos</strong>
                <span>
                  {creditosDisponiveis.length === 0
                    ? "Nenhum disponível"
                    : `${creditosDisponiveis.length} ${plural(creditosDisponiveis.length, "disponível", "disponíveis")}`}
                </span>
              </span>
            </button>
          </div>

          {saldos.length > 0 && (
            <div className="aluno-dica">
              Faça o check-in pelo <strong>{plataformas.join(" ou ")}</strong> sempre que vier ao Point.
              Não precisa ser no horário da aula: o importante é que, até <strong>{fimDoMes}</strong>, o
              número de check-ins seja igual ao de aulas.
            </div>
          )}

          <div className="inicio-meio">
            <section className="alunos-card aluno-proximas">
              <div className="inicio-exp-topo">
                <h2 className="chk-secao-titulo">Próximas aulas</h2>
                <Link to="/aluno/agenda" className="inicio-link-claro aluno-link">
                  Ver agenda completa <Icon name="chevron-right" size={16} />
                </Link>
              </div>
              {mensaisAtivas.length === 0 ? (
                <p className="alunos-vazio">
                  Nenhum plano mensal ativo ainda — suas próximas aulas aparecem aqui assim que você
                  tiver um.
                </p>
              ) : proximos.length === 0 ? (
                <p className="alunos-vazio">Nenhuma aula agendada nos próximos meses.</p>
              ) : (
                <ul className="aluno-aulas">
                  {proximos.map(({ item, data }, i) => (
                    <li className="aluno-aula" key={`${item.id}-${i}`}>
                      <span className="aluno-aula-data">
                        <span className="aluno-aula-dia">{data.getDate()}</span>
                        <span className="aluno-aula-mes">
                          {data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                        </span>
                      </span>
                      <span className="aluno-aula-info">
                        <span className="alunos-nome">
                          {data
                            .toLocaleDateString("pt-BR", { weekday: "long" })
                            .replace(/^\w/, (c) => c.toUpperCase())}{" "}
                          · {item.horario}
                        </span>
                        <span className="alunos-sub">
                          {item.titulo} · {item.subtitulo}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {temBanners && point && <AvisosDoPoint banners={point.banners} />}
          </div>

          {point && <CartaoDoPoint point={point} />}
        </div>
      )}
    </Layout>
  );
}
