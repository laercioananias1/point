import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { PainelRelatorio, PeriodoRelatorio, RelatorioResumo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

const PERIODOS: { valor: PeriodoRelatorio; rotulo: string; anterior: string }[] = [
  { valor: "semana", rotulo: "Semana", anterior: "semana anterior" },
  { valor: "mes", rotulo: "Mês", anterior: "mês anterior" },
  { valor: "trimestre", rotulo: "Trimestre", anterior: "trimestre anterior" },
];

// Primeira cor segue o tema (azul-escuro no claro, creme no escuro).
const CORES_ORIGEM = ["var(--ink)", "#3F6E86", "#9DB4C0", "#D8CDB6", "#E9DFCB"];

function dataLocal(iso: string): Date {
  return new Date(iso + "T00:00");
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "28 de setembro a 4 de outubro", "Outubro de 2026", "Agosto a outubro de 2026". */
function rotuloIntervalo(periodo: PeriodoRelatorio, inicio: string, fim: string): string {
  const i = dataLocal(inicio);
  const f = dataLocal(fim);
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
  if (periodo === "semana") return `${i.getDate()} de ${mes(i)} a ${f.getDate()} de ${mes(f)}`;
  if (periodo === "mes") return capitalizar(`${mes(f)} de ${f.getFullYear()}`);
  return capitalizar(`${mes(i)} a ${mes(f)} de ${f.getFullYear()}`);
}

/** Classe da célula do mapa de ocupação (escala do kit, vazio → lotado). */
function nivelMapa(v: number): string {
  if (v >= 90) return "n4";
  if (v >= 70) return "n3";
  if (v >= 45) return "n2";
  if (v >= 25) return "n1";
  return "n0";
}

type Tendencia = { texto: string; boa: boolean | null };

function tendenciaPontos(atual: number | null, anterior: number | null, menorEhMelhor = false): Tendencia {
  if (atual === null || anterior === null) return { texto: "sem base de comparação", boa: null };
  const diff = atual - anterior;
  if (diff === 0) return { texto: "estável", boa: null };
  const boa = menorEhMelhor ? diff < 0 : diff > 0;
  return { texto: `${diff > 0 ? "▲ +" : "▼ "}${diff} p.p.`, boa };
}

function tendenciaValor(atual: number, anterior: number): Tendencia {
  if (anterior === 0) return atual === 0 ? { texto: "estável", boa: null } : { texto: "▲ sem receita antes", boa: true };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: "estável", boa: null };
  return { texto: `${pct > 0 ? "▲ +" : "▼ "}${pct}%`, boa: pct > 0 };
}

function porcento(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

/** Relatórios do Point no layout do kit (design/telas/Relatorios.dc.html;
 * pedido do usuário, 2026-10-01: "vamos fazer o relatório, esse tem
 * protótipo") — indicadores do período comparados com o anterior, mapa de
 * ocupação dia × horário, receita por origem, funil da aula experimental,
 * desempenho por professor e o caixa dos últimos 6 meses (o relatório
 * anterior, pedido do usuário, 2026-09-20). Regras dos números em
 * backend/app/services/relatorios.py. */
export default function AdminPointRelatorios() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>("mes");
  const [painel, setPainel] = useState<PainelRelatorio | null>(null);
  const [resumo, setResumo] = useState<RelatorioResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    api
      .get<PainelRelatorio>(`/relatorios/painel?periodo=${periodo}`)
      .then(setPainel)
      .catch(() => setErro("Não foi possível carregar os relatórios. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [periodo]);

  useEffect(() => {
    api
      .get<RelatorioResumo>("/relatorios/resumo")
      .then(setResumo)
      .catch(() => undefined);
  }, []);

  const infoPeriodo = PERIODOS.find((p) => p.valor === periodo)!;

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">
            {painel ? rotuloIntervalo(painel.periodo, painel.inicio, painel.fim) : "Relatórios"}
          </div>
          <h1>Relatórios</h1>
        </div>
        <div className="rel-acoes">
          <div className="agenda-passos" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                role="tab"
                aria-selected={periodo === p.valor}
                className={periodo === p.valor ? "ativo" : ""}
                onClick={() => setPeriodo(p.valor)}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <button type="button" className="secondary rel-imprimir" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {carregando && !painel && <p className="empty-state">Carregando...</p>}

      {painel && (
        <div className={carregando ? "rel-corpo carregando" : "rel-corpo"}>
          <Indicadores painel={painel} anterior={infoPeriodo.anterior} />
          <MapaOcupacao painel={painel} />
          <div className="rel-linha">
            <ReceitaPorOrigem painel={painel} />
            <FunilExperimental funil={painel.funil} />
          </div>
          <Professores painel={painel} />
          {resumo && <Caixa resumo={resumo} />}
        </div>
      )}
    </Layout>
  );
}

function Indicadores({ painel, anterior }: { painel: PainelRelatorio; anterior: string }) {
  const i = painel.indicadores;
  const cards: { rotulo: string; valor: string; tendencia: Tendencia; classe: string }[] = [
    {
      rotulo: "Receita",
      valor: formatarReais(i.receita),
      tendencia: tendenciaValor(i.receita, i.receita_anterior),
      classe: "escuro",
    },
    {
      rotulo: "Ocupação média",
      valor: porcento(i.ocupacao),
      tendencia: tendenciaPontos(i.ocupacao, i.ocupacao_anterior),
      classe: "",
    },
    {
      rotulo: "Alunos ativos",
      valor: String(i.alunos_ativos),
      tendencia:
        i.alunos_novos === 0
          ? { texto: "nenhum aluno novo", boa: null }
          : { texto: `▲ +${i.alunos_novos} ${i.alunos_novos === 1 ? "novo" : "novos"}`, boa: true },
      classe: "",
    },
    {
      rotulo: "Conversão experimental",
      valor: porcento(i.conversao),
      tendencia: tendenciaPontos(i.conversao, i.conversao_anterior),
      classe: "limao",
    },
    {
      rotulo: "Taxa de faltas",
      valor: porcento(i.faltas),
      tendencia:
        i.faltas === null
          ? { texto: "sem chamada marcada", boa: null }
          : tendenciaPontos(i.faltas, i.faltas_anterior, true),
      classe: "",
    },
  ];
  return (
    <div className="chk-kpis chk-kpis-5 rel-kpis">
      {cards.map((c) => (
        <div key={c.rotulo} className={`chk-kpi ${c.classe}`}>
          <span className="chk-kpi-rotulo">{c.rotulo}</span>
          <span className="chk-kpi-valor">{c.valor}</span>
          <span
            className={`rel-tendencia${c.tendencia.boa === true ? " boa" : c.tendencia.boa === false ? " ruim" : ""}`}
            title={c.tendencia.boa === null ? undefined : `Comparado com ${anterior}`}
          >
            {c.tendencia.texto}
            {c.tendencia.boa !== null && c.rotulo !== "Alunos ativos" && ` vs. ${anterior}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function MapaOcupacao({ painel }: { painel: PainelRelatorio }) {
  return (
    <section className="alunos-card rel-secao">
      <div className="rel-secao-topo">
        <h2 className="chk-secao-titulo">Mapa de ocupação</h2>
        <span className="alunos-sub">Média de ocupação por dia e horário, todas as quadras</span>
      </div>
      {painel.mapa.length === 0 ? (
        <p className="alunos-vazio">Nenhuma aula no período.</p>
      ) : (
        <div className="rel-mapa-rolagem">
          <div className="rel-mapa" style={{ gridTemplateColumns: `48px repeat(${painel.horas.length}, minmax(44px, 1fr))` }}>
            <span />
            {painel.horas.map((h) => (
              <span key={h} className="rel-mapa-hora">
                {h}
              </span>
            ))}
            {painel.mapa.map((linha) => [
              <span key={`d-${linha.dia}`} className="rel-mapa-dia">
                {linha.dia}
              </span>,
              ...linha.celulas.map((v, i) =>
                v === null ? (
                  <span key={`${linha.dia}-${i}`} className="rel-mapa-celula sem-aula" />
                ) : (
                  <span
                    key={`${linha.dia}-${i}`}
                    className={`rel-mapa-celula ${nivelMapa(v)}`}
                    title={`${linha.dia} ${painel.horas[i]}: ${v}% de ocupação`}
                  >
                    {v}%
                  </span>
                ),
              ),
            ])}
          </div>
        </div>
      )}
      <div className="rel-mapa-legenda">
        <span>Vazio</span>
        {["n0", "n1", "n2", "n3", "n4"].map((n) => (
          <span key={n} className={`rel-mapa-amostra ${n}`} />
        ))}
        <span>Lotado</span>
        {painel.sugestao && <strong className="rel-sugestao">Sugestão: {painel.sugestao}</strong>}
      </div>
    </section>
  );
}

function ReceitaPorOrigem({ painel }: { painel: PainelRelatorio }) {
  const total = painel.receita_origem.reduce((s, r) => s + r.valor, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <section className="alunos-card rel-secao rel-meia">
      <div className="rel-secao-topo">
        <h2 className="chk-secao-titulo">Receita por origem</h2>
        <strong className="rel-total">{formatarReais(total)}</strong>
      </div>
      {total === 0 ? (
        <p className="alunos-sub">Nenhuma entrada no caixa nesse período.</p>
      ) : (
        <>
          <div className="rel-barra-empilhada">
            {painel.receita_origem.map((r, i) => (
              <span key={r.rotulo} style={{ width: `${pct(r.valor)}%`, background: CORES_ORIGEM[i] }} />
            ))}
          </div>
          <ul className="rel-lista">
            {painel.receita_origem.map((r, i) => (
              <li key={r.rotulo}>
                <span className="rel-cor" style={{ background: CORES_ORIGEM[i] }} />
                <span className="rel-lista-rotulo">{r.rotulo}</span>
                <span className="alunos-sub rel-lista-pct">{pct(r.valor)}%</span>
                <strong className="rel-lista-valor">{formatarReais(r.valor)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* Wellhub e TotalPass repassam fora do app — aqui só os check-ins. */}
      <ul className="rel-lista">
        <li>
          <span className="rel-cor plataforma" />
          <span className="rel-lista-rotulo">Wellhub</span>
          <span className="rel-plataforma">{painel.checkins_wellhub} check-ins · repasse da plataforma</span>
        </li>
        <li>
          <span className="rel-cor plataforma" />
          <span className="rel-lista-rotulo">TotalPass</span>
          <span className="rel-plataforma">{painel.checkins_totalpass} check-ins · repasse da plataforma</span>
        </li>
      </ul>
    </section>
  );
}

function FunilExperimental({ funil }: { funil: number[] }) {
  const rotulos = ["Pedidos pelo site", "Confirmadas", "Compareceram", "Se matricularam"];
  const base = funil[0];
  const naoVieram = funil[1] - funil[2];
  return (
    <section className="rel-funil">
      <div>
        <h2>Funil da aula experimental</h2>
        <span className="rel-funil-sub">Do pedido no site à matrícula</span>
      </div>
      {base === 0 ? (
        <p className="rel-funil-sub">Nenhum pedido de aula experimental nesse período.</p>
      ) : (
        rotulos.map((rotulo, i) => {
          const taxa = Math.round((funil[i] / base) * 100);
          return (
            <div key={rotulo} className="rel-funil-etapa">
              <div className="rel-funil-linha">
                <span>{rotulo}</span>
                <span>
                  <strong>{funil[i]}</strong> <span className="rel-funil-sub">· {taxa}%</span>
                </span>
              </div>
              <div className="rel-funil-trilho">
                <div
                  className={i === 3 ? "rel-funil-barra final" : "rel-funil-barra"}
                  style={{ width: `${Math.max(taxa, 3)}%` }}
                />
              </div>
            </div>
          );
        })
      )}
      {base > 0 && (
        <p className="rel-funil-nota">
          {naoVieram > 0
            ? `${naoVieram} ${naoVieram === 1 ? "pessoa confirmada não compareceu" : "pessoas confirmadas não compareceram"} — vale um lembrete no dia anterior.`
            : funil[3] === 0
              ? "Ninguém se matriculou ainda — um contato depois da aula ajuda a converter."
              : `${funil[3]} de ${base} ${base === 1 ? "pedido virou" : "pedidos viraram"} matrícula.`}
        </p>
      )}
    </section>
  );
}

function Professores({ painel }: { painel: PainelRelatorio }) {
  return (
    <section className="alunos-card rel-secao">
      <h2 className="chk-secao-titulo">Desempenho por professor</h2>
      {painel.professores.length === 0 ? (
        <p className="alunos-vazio">Nenhum professor com turma no Point.</p>
      ) : (
        <div className="alunos-tabela" role="table" aria-label="Desempenho por professor">
          <div className="alunos-linha rel-prof-grade alunos-cabecalho" role="row">
            <span role="columnheader">Professor</span>
            <span role="columnheader">Aulas dadas</span>
            <span role="columnheader">Alunos ativos</span>
            <span role="columnheader">Experimentais</span>
            <span role="columnheader">Faltas</span>
            <span role="columnheader">Ocupação média</span>
          </div>
          {painel.professores.map((p) => (
            <div key={p.nome} className="alunos-linha rel-prof-grade" role="row">
              <div className="alunos-pessoa" role="cell">
                <span className="agenda-presenca-avatar">
                  {p.nome
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((x) => x[0].toUpperCase())
                    .join("")}
                </span>
                <span className="alunos-pessoa-texto">
                  <span className="alunos-nome">{p.nome}</span>
                  <span className="alunos-sub">{p.modalidades}</span>
                </span>
              </div>
              <span role="cell" data-rotulo="Aulas dadas">
                {p.aulas_dadas}
              </span>
              <span role="cell" data-rotulo="Alunos ativos">
                {p.alunos_ativos}
              </span>
              <span role="cell" data-rotulo="Experimentais">
                {p.experimentais}
              </span>
              <span role="cell" data-rotulo="Faltas">
                {porcento(p.faltas)}
              </span>
              <span role="cell" data-rotulo="Ocupação média" className="turmas-vagas">
                <span className="turmas-trilho">
                  <span
                    className={
                      (p.ocupacao ?? 0) >= 80 ? "turmas-barra cheia" : (p.ocupacao ?? 0) >= 65 ? "turmas-barra alta" : "turmas-barra"
                    }
                    style={{ width: `${p.ocupacao ?? 0}%` }}
                  />
                </span>
                <span className="turmas-contagem">{porcento(p.ocupacao)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Caixa dos últimos 6 meses (relatório anterior, pedido do usuário,
 * 2026-09-20) — mantido embaixo, é o único lugar com despesa e saldo. */
function Caixa({ resumo }: { resumo: RelatorioResumo }) {
  const maior = Math.max(0, ...resumo.serie_mensal.flatMap((m) => [m.receita, m.despesa]));
  const mesCurto = (mes: string) => {
    const [ano, m] = mes.split("-").map(Number);
    return capitalizar(new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
  };
  return (
    <section className="alunos-card rel-secao">
      <div className="rel-secao-topo">
        <h2 className="chk-secao-titulo">Caixa — últimos 6 meses</h2>
        <span className="rel-legenda-caixa">
          <span>
            <i className="rel-cor receita" /> Receita
          </span>
          <span>
            <i className="rel-cor despesa" /> Despesa
          </span>
        </span>
      </div>
      <div className="rel-caixa">
        {maior === 0 ? (
          <p className="alunos-sub">Sem movimentação no caixa nesses meses.</p>
        ) : (
          <div className="rel-caixa-grafico">
            {resumo.serie_mensal.map((m) => (
              <div key={m.mes} className="rel-caixa-mes">
                <div className="rel-caixa-barras">
                  <span
                    className="rel-caixa-barra receita"
                    style={{ height: `${Math.max((m.receita / maior) * 100, m.receita > 0 ? 2 : 0)}%` }}
                    title={`Receita: ${formatarReais(m.receita)}`}
                  />
                  <span
                    className="rel-caixa-barra despesa"
                    style={{ height: `${Math.max((m.despesa / maior) * 100, m.despesa > 0 ? 2 : 0)}%` }}
                    title={`Despesa: ${formatarReais(m.despesa)}`}
                  />
                </div>
                <span className="alunos-sub">{mesCurto(m.mes)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rel-caixa-totais">
          <div>
            <span className="alunos-sub">Entrou</span>
            <strong>{formatarReais(resumo.entrou)}</strong>
          </div>
          <div>
            <span className="alunos-sub">Saiu</span>
            <strong>{formatarReais(resumo.saiu)}</strong>
          </div>
          <div>
            <span className="alunos-sub">A receber</span>
            <strong>{formatarReais(resumo.a_receber)}</strong>
          </div>
          <div>
            <span className="alunos-sub">Atrasado</span>
            <strong className={resumo.atrasado > 0 ? "rel-negativo" : ""}>{formatarReais(resumo.atrasado)}</strong>
          </div>
          <div className="rel-caixa-saldo">
            <span className="alunos-sub">Saldo</span>
            <strong className={resumo.saldo < 0 ? "rel-negativo" : ""}>{formatarReais(resumo.saldo)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
