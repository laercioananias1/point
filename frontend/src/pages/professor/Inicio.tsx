import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type {
  Feriado,
  Matricula,
  SaldoCheckinsAluno,
  SolicitacaoExperimental,
  TurmaResumo,
} from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import {
  feriadosNoMapa,
  matriculaTemAulaEm,
  ocorrenciasEmDatas,
  usePresenca,
  type OcorrenciaTurma,
  type Pessoa,
} from "../../components/AgendaTurmasCalendario";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "../../components/Calendar";
import { Carrossel } from "../../components/Carrossel";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { Icon, Layout, type IconName } from "../../components/Layout";
import { PedidosExperimentais } from "../../components/PedidosExperimentais";
import { faixaHorario, rotuloDias } from "../../lib/dias";
import { buscarFeriadosPorPoint } from "../../lib/feriados";

const LETRA_DIA = ["D", "S", "T", "Q", "Q", "S", "S"];

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

const NOME_PLATAFORMA: Record<string, string> = { wellhub: "Wellhub", totalpass: "TotalPass" };

/** Chave do saldo de um aluno: o saldo fecha por aluno + Point +
 * plataforma (mesma conta do acerto do mês). */
function chaveSaldo(alunoId: number, pointId: number, plataforma: string): string {
  return `${alunoId}-${pointId}-${plataforma}`;
}

function saldoDaMatricula(m: Matricula, saldos: Map<string, SaldoCheckinsAluno>): SaldoCheckinsAluno | null {
  if (m.fonte_pagamento !== "wellhub" && m.fonte_pagamento !== "totalpass") return null;
  return saldos.get(chaveSaldo(m.aluno_id, m.turma.vinculo.point_id, m.fonte_pagamento)) ?? null;
}

/** De onde vem o aluno — mesma leitura do protótipo (Mensalista, Wellhub,
 * Avulso...). Pra Wellhub/TotalPass o professor sabe que cada presença
 * precisa de um check-in no app da plataforma. */
function origemDaMatricula(m: Matricula): string {
  if (m.fonte_pagamento === "wellhub") return "Wellhub";
  if (m.fonte_pagamento === "totalpass") return "TotalPass";
  return m.tipo === "mensal" ? "Mensalista" : "Avulso";
}

/** Início do professor no layout do kit de design
 * (design/telas/AgendaProfessor.dc.html; pedido do usuário, 2026-10-01):
 * cabeçalho escuro com a semana em faixa, pedidos de aula experimental pra
 * responder ali mesmo e "Suas aulas" do dia escolhido — cada aula abre a
 * lista de alunos com a presença (mesmos endpoints da Agenda). A Agenda
 * completa (cancelar aula, cancelar a aula de um aluno, semana/mês)
 * continua na aba Agenda. Banners e dados do Point (pedido do usuário,
 * 2026-08-30) ficam no fim, pelo Point da primeira turma. */
export default function ProfessorInicio() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [aprovadas, setAprovadas] = useState<SolicitacaoExperimental[]>([]);
  const [pendentes, setPendentes] = useState<SolicitacaoExperimental[]>([]);
  const [saldos, setSaldos] = useState<SaldoCheckinsAluno[]>([]);
  const [feriadosPorPoint, setFeriadosPorPoint] = useState<Record<number, Feriado[]>>({});
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diaEscolhido, setDiaEscolhido] = useState(() => toISODate(new Date()));
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, matriculasRes, aprovadasRes, pendentesRes, saldosRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Matricula[]>("/professores/me/matriculas"),
        // Aprovadas contam como gente esperada na aula (pedido do usuário,
        // 2026-09-15); pendentes viram o card de pedidos. As duas já vêm
        // escopadas nas turmas do professor logado.
        api.get<SolicitacaoExperimental[]>("/experimental/solicitacoes?status=aprovada"),
        api.get<SolicitacaoExperimental[]>("/experimental/solicitacoes?status=pendente"),
        // Saldo de check-ins dos alunos Wellhub/TotalPass (pedido do
        // usuário, 2026-10-01: "professor tb tem q ver a situacao de
        // checkins para orienta-los a fazer") — complemento: se falhar,
        // a home segue sem ele.
        api.get<SaldoCheckinsAluno[]>("/wellhub/saldos-dos-meus-alunos").catch(() => []),
      ]);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setAprovadas(aprovadasRes);
      setPendentes(pendentesRes);
      setSaldos(saldosRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar seus dados. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pointIds = useMemo(() => Array.from(new Set(turmas.map((t) => t.vinculo.point_id))), [turmas]);
  useEffect(() => {
    if (pointIds.length === 0) return;
    buscarFeriadosPorPoint(pointIds).then(setFeriadosPorPoint);
  }, [pointIds]);

  const hoje = new Date();
  const hojeIso = toISODate(hoje);
  const semana = useMemo(() => {
    const inicio = inicioDaSemana(new Date());
    return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  }, []);
  const feriadosPorData = useMemo(() => feriadosNoMapa(turmas, feriadosPorPoint), [turmas, feriadosPorPoint]);
  const ocorrenciasPorDia = useMemo(
    () => ocorrenciasEmDatas(turmas, semana, feriadosPorData),
    [turmas, semana, feriadosPorData],
  );

  const doDia = (ocorrenciasPorDia.get(diaEscolhido) ?? [])
    .slice()
    .sort((a, b) => a.horario.localeCompare(b.horario));
  const ativasDoDia = doDia.filter((oc) => !oc.cancelada);
  const feriadoDoDia = feriadosPorData.get(diaEscolhido) ?? null;

  function pessoasDa(oc: OcorrenciaTurma): Pessoa[] {
    const iso = toISODate(oc.data);
    const dia = diaSemanaDeData(oc.data);
    return [
      ...matriculas
        .filter((m) => matriculaTemAulaEm(m, oc.turmaId, iso, dia))
        .map((m): Pessoa => ({ id: m.id, nome: m.aluno.nome, tipo: "matricula" })),
      ...aprovadas
        .filter((s) => s.turma.id === oc.turmaId && s.data === iso)
        .map((s): Pessoa => ({ id: s.id, nome: s.nome, tipo: "experimental" })),
    ];
  }

  const alunosDoDia = ativasDoDia.reduce((total, oc) => total + pessoasDa(oc).length, 0);
  const ehHoje = diaEscolhido === hojeIso;
  const dataEscolhida = semana.find((d) => toISODate(d) === diaEscolhido) ?? hoje;
  const rotuloDia = ehHoje
    ? "hoje"
    : dataEscolhida.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  // Próxima aula de hoje ainda não começada — ganha a borda limão, igual
  // ao destaque do protótipo.
  const agora = `${String(hoje.getHours()).padStart(2, "0")}:${String(hoje.getMinutes()).padStart(2, "0")}`;
  const proximaDeHoje = ehHoje ? ativasDoDia.find((oc) => oc.horario >= agora) ?? null : null;

  const saldosPorChave = useMemo(
    () => new Map(saldos.map((s) => [chaveSaldo(s.aluno_id, s.point_id, s.plataforma), s])),
    [saldos],
  );
  const nomesDosAlunos = useMemo(() => new Map(matriculas.map((m) => [m.aluno_id, m.aluno.nome])), [matriculas]);
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  const pointsNomes = Array.from(new Set(turmas.map((t) => t.vinculo.point.nome)));
  const point = turmas[0]?.vinculo.point ?? null;
  const temBanners = point !== null && point.banners.length > 0;

  const atalhos: { to: string; icone: IconName; rotulo: string }[] = [
    { to: "/professor/agenda", icone: "calendar", rotulo: "Agenda completa" },
    { to: "/professor/turmas", icone: "grid", rotulo: "Turmas" },
    { to: "/professor/ocupacao", icone: "chart", rotulo: "Ocupação de quadra" },
    { to: "/professor/experimental", icone: "user-plus", rotulo: "Aula experimental" },
  ];

  return (
    <Layout>
      <section className="aluno-hero">
        <div className="prof-hero-linha">
          {pointsNomes.length > 0 ? (
            <span className="aluno-hero-contexto">
              <Icon name="pin" size={16} /> {pointsNomes.join(" · ")}
            </span>
          ) : (
            <span />
          )}
          <span className="prof-hero-papel">Professor</span>
        </div>
        <div className="aluno-hero-topo">
          <span className="aluno-hero-contexto">Olá, {primeiroNome}</span>
          <h1 className="prof-hero-titulo">
            {!pronto
              ? "Sua semana"
              : feriadoDoDia
                ? `Feriado: ${feriadoDoDia}`
                : ativasDoDia.length === 0
                  ? `Nenhuma aula ${rotuloDia}`
                  : `${plural(ativasDoDia.length, "aula", "aulas")} ${rotuloDia} · ${plural(alunosDoDia, "aluno", "alunos")}`}
          </h1>
        </div>
        <div className="prof-semana" role="tablist" aria-label="Dias da semana">
          {semana.map((d) => {
            const iso = toISODate(d);
            const temAula = (ocorrenciasPorDia.get(iso) ?? []).some((oc) => !oc.cancelada);
            const classes = ["prof-dia"];
            if (iso === diaEscolhido) classes.push("escolhido");
            else if (iso === hojeIso) classes.push("hoje");
            return (
              <button
                type="button"
                role="tab"
                aria-selected={iso === diaEscolhido}
                key={iso}
                className={classes.join(" ")}
                onClick={() => {
                  setDiaEscolhido(iso);
                  setAberta(null);
                }}
              >
                <span className="prof-dia-letra">{LETRA_DIA[d.getDay()]}</span>
                <span className="prof-dia-numero">{d.getDate()}</span>
                <span className={temAula ? "prof-dia-ponto" : "prof-dia-ponto vazio"} />
              </button>
            );
          })}
        </div>
      </section>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <div className="aluno-corpo">
          {pendentes.length > 0 && (
            <PedidosExperimentais pedidos={pendentes} onMudanca={carregar} linkTodos="/professor/experimental" />
          )}

          <section className="prof-aulas">
            <h2 className="prof-aulas-titulo">Suas aulas · {rotuloDia}</h2>
            {turmas.length === 0 ? (
              <p className="alunos-card alunos-vazio">
                Nenhuma turma ainda — crie uma em <Link to="/professor/turmas">Turmas</Link>.
              </p>
            ) : doDia.length === 0 ? (
              <p className="alunos-card alunos-vazio">
                {feriadoDoDia ? `Feriado: ${feriadoDoDia}. Sem aulas.` : "Nenhuma aula neste dia."}
              </p>
            ) : (
              doDia.map((oc) => {
                const chave = `${oc.turmaId}-${toISODate(oc.data)}`;
                return (
                  <AulaDoDia
                    key={chave}
                    ocorrencia={oc}
                    pessoas={pessoasDa(oc)}
                    matriculas={matriculas}
                    saldos={saldosPorChave}
                    destaque={oc === proximaDeHoje}
                    aberta={aberta === chave}
                    onAlternar={() => setAberta(aberta === chave ? null : chave)}
                  />
                );
              })
            )}
          </section>

          {saldos.length > 0 && (
            <SaldosDosAlunos saldos={saldos} nomes={nomesDosAlunos} fimDoMes={fimDoMes} />
          )}

          <section className="alunos-card">
            <h2 className="chk-secao-titulo">Atalhos</h2>
            <div className="prof-atalhos">
              {atalhos.map((a) => (
                <Link key={a.to} to={a.to} className="prof-atalho">
                  <span className="aluno-atalho-icone">
                    <Icon name={a.icone} />
                  </span>
                  {a.rotulo}
                </Link>
              ))}
            </div>
          </section>

          {point && temBanners ? (
            <Carrossel fotos={point.banners} contido />
          ) : (
            <div className="banner-placeholder">
              <span className="banner-placeholder-icone">📣</span>
              <span>Espaço reservado pra avisos do Point.</span>
            </div>
          )}

          {point && (
            <section className="alunos-card aluno-point">
              <h2 className="chk-secao-titulo">{point.nome}</h2>
              <p className="aluno-point-linha">
                <Icon name="pin" size={16} /> {point.endereco}
              </p>
              <p className="aluno-point-linha">
                <Icon name="clock" size={16} />
                <span>
                  {rotuloDias(point.dias_semana_funcionamento)}:{" "}
                  {faixaHorario(point.horarios_semana_funcionamento)}
                  {point.dias_fds_funcionamento.length > 0 && (
                    <>
                      {" "}
                      · {rotuloDias(point.dias_fds_funcionamento)}:{" "}
                      {faixaHorario(point.horarios_fds_funcionamento)}
                    </>
                  )}
                </span>
              </p>
              {point.fotos.length > 0 && <Carrossel fotos={point.fotos} />}
              {point.sobre && (
                <div>
                  <h3 className="aluno-point-titulo">Sobre</h3>
                  <p className="inicio-texto-point">{point.sobre}</p>
                </div>
              )}
              {point.informacoes_importantes && (
                <div>
                  <h3 className="aluno-point-titulo">Informações importantes</h3>
                  <p className="inicio-texto-point">{point.informacoes_importantes}</p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}

/** Uma aula do dia: horário, turma, quadra e lotação; clicando abre os
 * alunos com a presença (Presente/Marcar). Cancelada mostra o motivo e
 * não abre. */
function AulaDoDia({
  ocorrencia: oc,
  pessoas,
  matriculas,
  saldos,
  destaque,
  aberta,
  onAlternar,
}: {
  ocorrencia: OcorrenciaTurma;
  pessoas: Pessoa[];
  matriculas: Matricula[];
  saldos: Map<string, SaldoCheckinsAluno>;
  destaque: boolean;
  aberta: boolean;
  onAlternar: () => void;
}) {
  const vagas = oc.capacidade - pessoas.length;
  const tag = oc.cancelada
    ? { texto: "Cancelada", classe: "cancelada" }
    : vagas <= 0
      ? { texto: "Lotada", classe: "lotada" }
      : { texto: plural(vagas, "vaga", "vagas"), classe: "" };

  return (
    <div className={`prof-aula${destaque ? " destaque" : ""}${oc.cancelada ? " cancelada" : ""}`}>
      <button
        type="button"
        className="prof-aula-cabeca"
        onClick={onAlternar}
        disabled={oc.cancelada}
        aria-expanded={aberta}
      >
        <span className="prof-aula-hora">
          <span className="prof-aula-horario">{oc.horario}</span>
          <span className="alunos-sub">{oc.duracaoMinutos} min</span>
        </span>
        <span className="prof-aula-info">
          <span className="alunos-nome">
            {oc.modalidadeNome} <CategoriaBadge nome={oc.categoriaNome} cor={oc.categoriaCor} />
          </span>
          <span className="alunos-sub">
            {oc.cancelada
              ? oc.motivoCancelamento
              : `${oc.quadraNome} · ${pessoas.length}/${oc.capacidade} alunos`}
          </span>
        </span>
        <span className={`prof-aula-tag ${tag.classe}`}>{tag.texto}</span>
      </button>
      {aberta && !oc.cancelada && <ListaPresenca ocorrencia={oc} pessoas={pessoas} matriculas={matriculas} saldos={saldos} />}
    </div>
  );
}

function ListaPresenca({
  ocorrencia: oc,
  pessoas,
  matriculas,
  saldos,
}: {
  ocorrencia: OcorrenciaTurma;
  pessoas: Pessoa[];
  matriculas: Matricula[];
  saldos: Map<string, SaldoCheckinsAluno>;
}) {
  const { presentes, carregado, alterando, alternar, chave } = usePresenca(oc.turmaId, toISODate(oc.data));
  const porId = new Map(matriculas.map((m) => [m.id, m]));

  if (pessoas.length === 0) {
    return <p className="prof-aula-vazio">Nenhum aluno nessa aula.</p>;
  }

  return (
    <div className="prof-presenca">
      <span className="prof-presenca-resumo">
        Presença {carregado && `· ${presentes.size} de ${pessoas.length}`}
      </span>
      {pessoas.map((p) => {
        const presente = presentes.has(chave(p));
        const m = p.tipo === "matricula" ? porId.get(p.id) : undefined;
        const saldo = m ? saldoDaMatricula(m, saldos) : null;
        return (
          <div className="prof-presenca-linha" key={chave(p)}>
            <span className="alunos-pessoa-texto">
              <span className="alunos-nome">
                {p.nome}
                {saldo && saldo.saldo < 0 && (
                  <span className="prof-saldo-pilula">
                    {saldo.saldo === -1 ? "falta 1 check-in" : `faltam ${-saldo.saldo} check-ins`}
                  </span>
                )}
              </span>
              <span className="alunos-sub">
                {m ? origemDaMatricula(m) : "Aula experimental"}
                {saldo &&
                  ` · mês: ${plural(saldo.aulas, "aula", "aulas")}, ${plural(saldo.checkins, "check-in", "check-ins")}`}
              </span>
            </span>
            <button
              type="button"
              className={`prof-presenca-botao${presente ? " presente" : ""}`}
              disabled={!carregado || alterando === chave(p)}
              aria-label={`Presença de ${p.nome}: ${presente ? "presente" : "não marcada"}`}
              onClick={() => alternar(p)}
            >
              {presente ? (
                <>
                  <Icon name="check" size={14} /> Presente
                </>
              ) : (
                "Marcar"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Situação de check-ins dos alunos Wellhub/TotalPass do professor no mês
 * (pedido do usuário, 2026-10-01: "professor tb tem q ver a situacao de
 * checkins para orienta-los a fazer") — mesmo texto-guia do protótipo
 * (design/telas/CheckinsProfessor.dc.html): quem está devendo aparece
 * primeiro, pra ele pedir o check-in na quadra. */
function SaldosDosAlunos({
  saldos,
  nomes,
  fimDoMes,
}: {
  saldos: SaldoCheckinsAluno[];
  nomes: Map<number, string>;
  fimDoMes: string;
}) {
  const devendo = saldos.filter((s) => s.saldo < 0).sort((a, b) => a.saldo - b.saldo);
  const plataformas = Array.from(new Set(saldos.map((s) => NOME_PLATAFORMA[s.plataforma] ?? s.plataforma)));
  const variosPoints = new Set(saldos.map((s) => s.point_id)).size > 1;

  return (
    <section className="alunos-card prof-saldos">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">Check-ins dos alunos</h2>
        <span className={`status-pill ${devendo.length > 0 ? "status-risk" : "status-good"}`}>
          {devendo.length > 0 ? `${plural(devendo.length, "aluno devendo", "alunos devendo")}` : "Todos em dia"}
        </span>
      </div>
      <p className="prof-saldos-dica">
        Para alunos {plataformas.join(" e ")}, cada aula precisa de um check-in no app da plataforma. Não
        importa o dia: até <strong>{fimDoMes}</strong> a quantidade de check-ins tem que empatar com a de
        aulas. Aproveite a aula pra pedir o check-in a quem está devendo.
      </p>
      {devendo.length === 0 ? (
        <p className="alunos-sub">
          {plural(saldos.length, "aluno com benefício", "alunos com benefício")} — nenhum com check-in faltando
          neste mês.
        </p>
      ) : (
        <ul className="prof-saldos-lista">
          {devendo.map((s) => (
            <li key={`${s.aluno_id}-${s.point_id}-${s.plataforma}`} className="prof-saldos-linha">
              <span className="alunos-pessoa-texto">
                <span className="alunos-nome">{nomes.get(s.aluno_id) ?? "Aluno"}</span>
                <span className="alunos-sub">
                  {NOME_PLATAFORMA[s.plataforma] ?? s.plataforma}
                  {variosPoints && ` · ${s.point_nome}`} · {plural(s.aulas, "aula", "aulas")},{" "}
                  {plural(s.checkins, "check-in", "check-ins")}
                </span>
              </span>
              <span className="prof-saldos-numero">{s.saldo}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
