import { useEffect, useState } from "react";
import type { Categoria, Matricula, Quadra, TurmaResumo } from "../api/types";
import { CategoriaBadge } from "./CategoriaBadge";
import { Icon } from "./Layout";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";

type ModoVisualizacao = "real" | "disponibilidade";

const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Cor de quando duas categorias diferentes caem no mesmo horário/quadra —
// não dá pra pintar com uma cor só sem mentir qual categoria é.
const COR_MISTA = "#3F6E86";

/** "#rrggbb" -> "r, g, b", pra variar a opacidade da cor da categoria em
 * rgba() (pedido do usuário, 2026-09-08: "pinta aqui a célula com a cor
 * da categoria"). */
function hexParaRgb(hex: string): string {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Fundo da caixa na cor da categoria (pedido do usuário, 2026-10-01: "a
 * cor da aula deixa na caixa do dia, não precisa ser somente uma
 * bolinha") — a intensidade é a ocupação: clarinha vazia, forte quase
 * cheia, cor sólida lotada. */
function estiloDaCelula(cor: string, alunos: number, capacidade: number) {
  const rgb = hexParaRgb(cor);
  const fracao = capacidade > 0 ? Math.min(1, alunos / capacidade) : 1;
  if (fracao >= 1) {
    return { background: `rgb(${rgb})`, borderLeftColor: `rgb(${rgb})`, color: "#FFFFFF" };
  }
  const alpha = alunos === 0 ? 0.12 : 0.24 + fracao * 0.5;
  return { background: `rgba(${rgb}, ${alpha})`, borderLeftColor: `rgb(${rgb})` };
}


type Selecionado = {
  quadra: Quadra;
  data: Date;
  hora: number;
  matriculasDoDia: Matricula[];
  capacidade: number;
};

/** Ocupação de ALUNOS por quadra, numa semana específica (pedido do
 * usuário, 2026-08-26: primeiro "quadra em uso ou não" não ajudou muito —
 * o que interessa é quanto de cada turma tá preenchido; depois, pedido de
 * mostrar a data de cada dia e navegar entre semanas; depois, pedido de
 * clicar num dia ocupado e ver os nomes dos alunos daquela aula). Datas de
 * verdade (não só "toda terça") importam aqui porque uma semana pode ter
 * aula cancelada por força maior (TurmaResumo.excecoes) ou aluno que
 * cancelou só aquele dia (Matricula.excecoes) — sem isso a conta ficaria
 * errada pra qualquer semana com algum cancelamento.
 *
 * Conta os dois tipos de matrícula: mensal usa matricula.dias_semana, o
 * subconjunto de dias que esse aluno frequenta dentro da turma (pedido do
 * usuário, 2026-08-21); avulsa usa data_inicio_efetiva como data única
 * (pedido do usuário, 2026-08-26).
 *
 * Layout do kit (pedido do usuário, 2026-10-01: "uma tela q precisa ficar
 * bonita"): números da semana no topo, cada quadra num card, caixa de cada
 * aula na cor da categoria com a intensidade pela ocupação. */
export function GraficoOcupacao({
  turmas,
  matriculas,
}: {
  turmas: TurmaResumo[];
  matriculas: Matricula[];
}) {
  const [referencia, setReferencia] = useState(new Date());
  // "real" = ocupação de verdade (quantidade de alunos), pro professor/
  // admin acompanhar; "disponibilidade" = só diz se tem vaga ou não, sem
  // número nenhum (pedido do usuário, 2026-09-08: "eles não precisam saber
  // toda ocupação real, só precisa saber se tem disponibilidade") — é o
  // modo pensado pra um dia virar a tela que o aluno vê.
  const [modo, setModo] = useState<ModoVisualizacao>("real");
  const [selecionado, setSelecionado] = useState<Selecionado | null>(null);

  if (turmas.length === 0) {
    return (
      <p className="alunos-card alunos-vazio">
        Nenhuma turma ativa ainda — a ocupação aparece aqui assim que tiver.
      </p>
    );
  }

  const inicio = inicioDaSemana(referencia);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const hoje = toISODate(new Date());
  const semanaAtual = toISODate(inicio) === toISODate(inicioDaSemana(new Date()));

  function tituloSemana(): string {
    const fim = diasDaSemana[6];
    const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
    return inicio.getMonth() === fim.getMonth()
      ? `${inicio.getDate()} – ${fim.getDate()} de ${mes(fim)}`
      : `${inicio.getDate()} de ${mes(inicio)} – ${fim.getDate()} de ${mes(fim)}`;
  }

  function turmaOcorreNaData(t: TurmaResumo, data: Date): boolean {
    const iso = toISODate(data);
    const dentroDoPeriodo = iso >= t.periodo_inicio && (t.periodo_fim === null || iso <= t.periodo_fim);
    return t.dias_semana.includes(diaSemanaDeData(data)) && dentroDoPeriodo && !t.excecoes.includes(iso);
  }

  function matriculasNaData(turmaId: number, data: Date): Matricula[] {
    const iso = toISODate(data);
    const dia = diaSemanaDeData(data);
    return matriculas.filter((m) => {
      if (m.turma_id !== turmaId || m.status !== "ativa") return false;
      if (m.tipo === "mensal") {
        return m.dias_semana.includes(dia) && iso >= m.data_inicio_efetiva && !m.excecoes.includes(iso);
      }
      // Avulsa: data_inicio_efetiva é a data única escolhida na compra
      // (pedido do usuário, 2026-08-26).
      return m.data_inicio_efetiva === iso;
    });
  }

  // Uma quadra por card — mais fácil de ler do que uma grade só somando tudo.
  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values()).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );

  // Categorias em jogo (pedido do usuário, 2026-09-08: "coloque uma
  // legenda") — agora é o pontinho de cada célula.
  const categorias: Categoria[] = Array.from(new Map(turmas.map((t) => [t.categoria.id, t.categoria])).values()).sort(
    (a, b) => a.nome.localeCompare(b.nome),
  );

  // Monta todas as células da semana de uma vez — os números do topo saem
  // da mesma conta que pinta a grade.
  type Celula = {
    iso: string;
    data: Date;
    hora: number;
    alunos: number;
    capacidade: number;
    categorias: Categoria[];
    matriculasDoDia: Matricula[];
  };
  const porQuadra = quadras.map((quadra) => {
    const turmasDaQuadra = turmas.filter((t) => t.quadra.id === quadra.id);
    const horas = Array.from(new Set(turmasDaQuadra.map((t) => Number(t.horario.split(":")[0])))).sort(
      (a, b) => a - b,
    );
    const celulas = new Map<string, Celula>();
    for (const hora of horas) {
      for (const data of diasDaSemana) {
        const iso = toISODate(data);
        const turmasSlot = turmasDaQuadra.filter(
          (t) => Number(t.horario.split(":")[0]) === hora && turmaOcorreNaData(t, data),
        );
        if (turmasSlot.length === 0) continue;
        const matriculasDoDia = turmasSlot.flatMap((t) => matriculasNaData(t.id, data));
        celulas.set(`${iso}-${hora}`, {
          iso,
          data,
          hora,
          alunos: matriculasDoDia.length,
          capacidade: turmasSlot.reduce((soma, t) => soma + t.capacidade, 0),
          categorias: Array.from(new Map(turmasSlot.map((t) => [t.categoria.id, t.categoria])).values()),
          matriculasDoDia,
        });
      }
    }
    const lista = Array.from(celulas.values());
    const alunos = lista.reduce((s, c) => s + c.alunos, 0);
    const capacidade = lista.reduce((s, c) => s + c.capacidade, 0);
    return {
      quadra,
      horas,
      celulas,
      alunos,
      capacidade,
      aulas: lista.length,
      lotadas: lista.filter((c) => c.alunos >= c.capacidade).length,
      ocupacao: capacidade > 0 ? Math.round((alunos / capacidade) * 100) : 0,
    };
  });

  const totalAlunos = porQuadra.reduce((s, q) => s + q.alunos, 0);
  const totalCapacidade = porQuadra.reduce((s, q) => s + q.capacidade, 0);
  const totalAulas = porQuadra.reduce((s, q) => s + q.aulas, 0);
  const totalLotadas = porQuadra.reduce((s, q) => s + q.lotadas, 0);
  const ocupacaoSemana = totalCapacidade > 0 ? Math.round((totalAlunos / totalCapacidade) * 100) : 0;

  return (
    <div className="ocup">
      {selecionado && <DetalhesAulaModal selecionado={selecionado} onFechar={() => setSelecionado(null)} />}

      <div className="agenda-nav-linha ocup-nav">
        <div className="agenda-nav-periodo">
          <button
            type="button"
            className="agenda-seta"
            onClick={() => setReferencia((r) => somarDias(r, -7))}
            aria-label="Semana anterior"
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <h3 className="agenda-nav-rotulo">{tituloSemana()}</h3>
          <button
            type="button"
            className="agenda-seta"
            onClick={() => setReferencia((r) => somarDias(r, 7))}
            aria-label="Próxima semana"
          >
            <Icon name="chevron-right" size={18} />
          </button>
          {!semanaAtual && (
            <button type="button" className="filtro-pilula" onClick={() => setReferencia(new Date())}>
              Esta semana
            </button>
          )}
        </div>
        <div className="agenda-passos" role="tablist" aria-label="Modo de visualização">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "real"}
            className={modo === "real" ? "ativo" : ""}
            onClick={() => setModo("real")}
          >
            Ocupação real
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "disponibilidade"}
            className={modo === "disponibilidade" ? "ativo" : ""}
            onClick={() => setModo("disponibilidade")}
          >
            Só disponibilidade
          </button>
        </div>
      </div>

      {modo === "real" && (
        <div className="chk-kpis">
          <div className="chk-kpi escuro">
            <span className="chk-kpi-rotulo">Ocupação da semana</span>
            <span className="chk-kpi-valor">{ocupacaoSemana}%</span>
            <span className="chk-kpi-nota">
              {quadras.length} {quadras.length === 1 ? "quadra" : "quadras"}
            </span>
          </div>
          <div className="chk-kpi">
            <span className="chk-kpi-rotulo">Vagas ocupadas</span>
            <span className="chk-kpi-valor">{totalAlunos}</span>
            <span className="chk-kpi-nota">de {totalCapacidade} vagas na semana</span>
          </div>
          <div className="chk-kpi">
            <span className="chk-kpi-rotulo">Aulas na semana</span>
            <span className="chk-kpi-valor">{totalAulas}</span>
            <span className="chk-kpi-nota">com turma marcada</span>
          </div>
          <div className="chk-kpi limao">
            <span className="chk-kpi-rotulo">Aulas lotadas</span>
            <span className="chk-kpi-valor">{totalLotadas}</span>
            <span className="chk-kpi-nota">sem vaga sobrando</span>
          </div>
        </div>
      )}

      {porQuadra.map(({ quadra, horas, celulas, ocupacao }) => (
        <section key={quadra.id} className="alunos-card ocup-quadra">
          <div className="ocup-quadra-topo">
            <h2 className="chk-secao-titulo">{quadra.nome}</h2>
            {/* Some no modo disponibilidade (pedido do usuário, 2026-09-08)
                — é exatamente o número que esse modo existe pra não expor. */}
            {modo === "real" && (
              <div className="ocup-quadra-barra" title={`${ocupacao}% de ocupação nessa semana`}>
                <span className="turmas-trilho">
                  <span className="ocup-quadra-preenchido" style={{ width: `${ocupacao}%` }} />
                </span>
                <strong>{ocupacao}%</strong>
                <span className="alunos-sub">na semana</span>
              </div>
            )}
          </div>

          <div className="ocup-rolagem">
            <div className="ocup-grade">
              <span />
              {diasDaSemana.map((data) => {
                const iso = toISODate(data);
                return (
                  <span key={iso} className={iso === hoje ? "ocup-dia hoje" : "ocup-dia"}>
                    <span className="ocup-dia-semana">{DIA_CURTO[data.getDay()]}</span>
                    <span className="ocup-dia-numero">{data.getDate()}</span>
                  </span>
                );
              })}

              {horas.map((hora) => [
                <span key={`h-${hora}`} className="ocup-hora">
                  {hora}h
                </span>,
                ...diasDaSemana.map((data) => {
                  const iso = toISODate(data);
                  const c = celulas.get(`${iso}-${hora}`);
                  if (!c) return <span key={`${iso}-${hora}`} className="ocup-celula sem-aula" />;

                  const nomes = c.categorias.map((cat) => cat.nome).join(" + ");
                  const dataFormatada = data.toLocaleDateString("pt-BR");
                  const cor = c.categorias.length === 1 ? c.categorias[0].cor : COR_MISTA;
                  // Pontinhos só quando o horário mistura categorias.
                  const pontos =
                    c.categorias.length > 1 ? (
                      <span className="ocup-pontos" aria-hidden="true">
                        {c.categorias.map((cat) => (
                          <span key={cat.id} className="categoria-dot" style={{ background: cat.cor }} />
                        ))}
                      </span>
                    ) : null;

                  // Modo disponibilidade (pedido do usuário, 2026-09-08) —
                  // só diz se tem vaga ou não, sem número nem clique.
                  if (modo === "disponibilidade") {
                    const lotado = c.alunos >= c.capacidade;
                    return (
                      <span
                        key={`${iso}-${hora}`}
                        className={lotado ? "ocup-celula disp-lotado" : "ocup-celula disp-vaga"}
                        style={
                          lotado
                            ? { borderLeftColor: cor }
                            : { borderLeftColor: cor, background: `rgba(${hexParaRgb(cor)}, 0.14)` }
                        }
                        title={`${quadra.nome} · ${dataFormatada} ${hora}h — ${nomes} — ${lotado ? "lotado" : "tem vaga"}`}
                      >
                        {pontos}
                        {lotado ? (
                          <span className="ocup-disp-lotado">Lotado</span>
                        ) : (
                          <span className="ocup-disp-vaga">
                            <span className="ocup-disp-ponto" /> Vaga
                          </span>
                        )}
                      </span>
                    );
                  }

                  const abrir = () =>
                    setSelecionado({
                      quadra,
                      data,
                      hora,
                      matriculasDoDia: c.matriculasDoDia,
                      capacidade: c.capacidade,
                    });
                  return (
                    <button
                      key={`${iso}-${hora}`}
                      type="button"
                      className="ocup-celula com-cor"
                      style={estiloDaCelula(cor, c.alunos, c.capacidade)}
                      title={`${quadra.nome} · ${dataFormatada} ${hora}h — ${nomes} — ${c.alunos} de ${c.capacidade} vaga(s) ocupada(s). Clique pra ver os nomes.`}
                      onClick={abrir}
                    >
                      {pontos}
                      <span className="ocup-valor">
                        {c.alunos}/{c.capacidade}
                      </span>
                    </button>
                  );
                }),
              ])}
            </div>
          </div>
        </section>
      ))}

      {/* Sem escala de ocupação na legenda (pedido do usuário, 2026-10-01:
          "não vejo tanta utilidade") — o número na caixa já diz. Fica só a
          dica e qual cor é qual categoria. */}
      <div className="ocup-legenda">
        {modo === "real" && <span className="ocup-legenda-dica">Clique numa aula pra ver os alunos.</span>}
        {categorias.length > 0 && (
          <span className="ocup-legenda-categorias">
            {categorias.map((c) => (
              <CategoriaBadge key={c.id} nome={c.nome} cor={c.cor} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/** Quem vai ter aula naquele dia/horário específico (pedido do usuário,
 * 2026-08-26: "dá pra ver o nome dos alunos que vão fazer aula no dia?"). */
function DetalhesAulaModal({ selecionado, onFechar }: { selecionado: Selecionado; onFechar: () => void }) {
  const { quadra, data, hora, matriculasDoDia, capacidade } = selecionado;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const rotuloData = data
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
  const vagas = Math.max(0, capacidade - matriculasDoDia.length);

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card ocup-modal" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="agenda-detalhe-titulo">
            {quadra.nome} · {hora}h
          </h2>
          <p className="alunos-sub">{rotuloData}</p>
        </div>

        <div className="agenda-detalhe-numeros ocup-modal-numeros">
          <div>
            <strong>{matriculasDoDia.length}</strong>
            <span>inscritos</span>
          </div>
          <div>
            <strong>{vagas}</strong>
            <span>{vagas === 1 ? "vaga" : "vagas"}</span>
          </div>
        </div>

        {matriculasDoDia.length === 0 ? (
          <p className="alunos-sub">Ninguém matriculado nesse dia e horário ainda.</p>
        ) : (
          <div className="agenda-presenca">
            {matriculasDoDia.map((m) => {
              const iniciais = m.aluno.nome
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0].toUpperCase())
                .join("");
              return (
                <div key={m.id} className="agenda-presenca-linha">
                  <span className="agenda-presenca-avatar">{iniciais}</span>
                  <span className="alunos-pessoa-texto agenda-presenca-pessoa">
                    <span className="alunos-nome">{m.aluno.nome}</span>
                    <span className="alunos-sub">
                      {m.turma.modalidade.nome} · {m.tipo === "mensal" ? "Mensalista" : "Avulso"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
