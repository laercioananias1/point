import { useEffect, useState } from "react";
import type { Categoria, Matricula, Quadra, TurmaResumo } from "../api/types";
import { CategoriaBadge } from "./CategoriaBadge";
import { Icon } from "./Layout";
import { DIAS_SEMANA } from "../lib/dias";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";

type ModoVisualizacao = "real" | "disponibilidade";

/** "#rrggbb" -> "r, g, b", pra poder variar a opacidade da cor da
 * categoria em rgba() (pedido do usuário, 2026-09-08: "pinta aqui a
 * célula com a cor da categoria") — custom property não dá pra recombinar
 * com opacidade direto no style, por isso o valor já sai pronto pra
 * `rgba(${...}, opacidade)`. */
function hexParaRgb(hex: string): string {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

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
 * (pedido do usuário, 2026-08-26 — antes avulsa não tinha data própria de
 * verdade, então ficava de fora daqui; isso foi corrigido quando a compra
 * de aula avulsa passou a exigir escolher o dia no calendário). */
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
  const [selecionado, setSelecionado] = useState<{
    quadra: Quadra;
    data: Date;
    hora: number;
    matriculasDoDia: Matricula[];
    capacidade: number;
  } | null>(null);

  if (turmas.length === 0) {
    return <p className="empty-state">Nenhuma turma ativa ainda — a ocupação aparece aqui assim que tiver.</p>;
  }

  const inicio = inicioDaSemana(referencia);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const hoje = toISODate(new Date());

  function tituloSemana(): string {
    const fim = diasDaSemana[6];
    const dia = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit" });
    const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" });
    return inicio.getMonth() === fim.getMonth()
      ? `${dia(inicio)}–${dia(fim)} de ${mes(fim)}`
      : `${dia(inicio)} de ${mes(inicio)} – ${dia(fim)} de ${mes(fim)}`;
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

  // Uma quadra por bloco — mais fácil de ler do que uma grade só somando tudo.
  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values());

  // Categorias em jogo nessa semana (pedido do usuário, 2026-09-08: "pinta
  // aqui a célula com a cor da categoria e coloque uma legenda") — cada
  // célula ocupada usa a cor da categoria da turma; essa legenda diz qual
  // cor é qual categoria.
  const categoriasNaSemana: Categoria[] = Array.from(
    new Map(turmas.map((t) => [t.categoria.id, t.categoria])).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {selecionado && (
        <DetalhesAulaModal selecionado={selecionado} onFechar={() => setSelecionado(null)} />
      )}

      <div className="calendar-nav">
        <button className="secondary" onClick={() => setReferencia((r) => somarDias(r, -7))}>
          ‹
        </button>
        <button className="secondary" onClick={() => setReferencia(new Date())}>
          Hoje
        </button>
        <button className="secondary" onClick={() => setReferencia((r) => somarDias(r, 7))}>
          ›
        </button>
        <span className="calendar-title">{tituloSemana()}</span>
      </div>

      <div className="toggle-grid" role="group" aria-label="Modo de visualização">
        <button
          type="button"
          className={modo === "real" ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setModo("real")}
        >
          Ocupação real
        </button>
        <button
          type="button"
          className={modo === "disponibilidade" ? "toggle-chip active" : "toggle-chip"}
          onClick={() => setModo("disponibilidade")}
        >
          Só disponibilidade
        </button>
      </div>

      {categoriasNaSemana.length > 0 && (
        <div className="ocupacao-legenda-categorias">
          {categoriasNaSemana.map((c) => (
            <CategoriaBadge key={c.id} nome={c.nome} cor={c.cor} />
          ))}
        </div>
      )}

      {quadras.map((quadra) => {
        const turmasDaQuadra = turmas.filter((t) => t.quadra.id === quadra.id);
        const horasEmUso = Array.from(
          new Set(turmasDaQuadra.map((t) => Number(t.horario.split(":")[0]))),
        ).sort((a, b) => a - b);

        let somaAlunos = 0;
        let somaCapacidade = 0;

        const celulas = [
          <div className="ocupacao-cell ocupacao-corner" key="corner" />,
          ...diasDaSemana.map((data) => {
            const iso = toISODate(data);
            return (
              <div
                className={iso === hoje ? "ocupacao-cell ocupacao-header hoje" : "ocupacao-cell ocupacao-header"}
                key={`cabecalho-${iso}`}
              >
                {DIAS_SEMANA[(data.getDay() + 6) % 7].label} {data.getDate()}
              </div>
            );
          }),
          ...horasEmUso.flatMap((hora) => [
            <div className="ocupacao-cell ocupacao-hour-label" key={`hora-${hora}`}>
              {hora}h
            </div>,
            ...diasDaSemana.map((data) => {
              const iso = toISODate(data);
              const turmasSlot = turmasDaQuadra.filter(
                (t) => Number(t.horario.split(":")[0]) === hora && turmaOcorreNaData(t, data),
              );
              if (turmasSlot.length === 0) {
                return <div className="ocupacao-cell ocupacao-slot ocupacao-slot-vazio" key={`${iso}-${hora}`} />;
              }
              const matriculasDoDia = turmasSlot.flatMap((t) => matriculasNaData(t.id, data));
              const alunos = matriculasDoDia.length;
              const capacidade = turmasSlot.reduce((soma, t) => soma + t.capacidade, 0);
              somaAlunos += alunos;
              somaCapacidade += capacidade;
              const fracao = capacidade > 0 ? alunos / capacidade : 0;
              // Cor da categoria da turma (pedido do usuário, 2026-09-08) —
              // se por acaso duas turmas de categorias diferentes caem no
              // mesmo slot (mesma quadra/dia/hora, ex.: dois professores),
              // não dá pra pintar com uma cor só sem mentir qual categoria
              // é; cai no teal neutro de sempre nesse caso raro.
              const categoriasSlot = Array.from(
                new Map(turmasSlot.map((t) => [t.categoria.id, t.categoria])).values(),
              );
              const corBase =
                categoriasSlot.length === 1 ? hexParaRgb(categoriasSlot[0].cor) : "14, 149, 148";
              const lotado = fracao >= 1;
              const nomesCategoria = categoriasSlot.map((c) => c.nome).join(" + ");
              const dataFormatada = new Date(iso + "T00:00").toLocaleDateString("pt-BR");

              // Modo disponibilidade (pedido do usuário, 2026-09-08) — só
              // diz se tem vaga ou não, sem número de aluno/capacidade nem
              // clique pra ver nomes (é o modo pensado pra um dia virar a
              // tela do aluno, que não precisa saber a ocupação real).
              if (modo === "disponibilidade") {
                return (
                  <div
                    className="ocupacao-cell ocupacao-slot ocupacao-slot-ocupado"
                    key={`${iso}-${hora}`}
                    style={{
                      background: lotado ? "var(--risk-soft)" : `rgba(${corBase}, 0.35)`,
                      borderLeft: `3px solid ${lotado ? "var(--risk)" : `rgb(${corBase})`}`,
                      color: lotado ? "var(--risk)" : "var(--good)",
                    }}
                    title={`${quadra.nome} · ${dataFormatada} ${hora}h — ${nomesCategoria} — ${lotado ? "lotado" : "disponível"}`}
                  >
                    <Icon name={lotado ? "x-circle" : "check-circle"} size={14} />
                  </div>
                );
              }

              return (
                <div
                  className="ocupacao-cell ocupacao-slot ocupacao-slot-ocupado ocupacao-slot-clicavel"
                  key={`${iso}-${hora}`}
                  role="button"
                  tabIndex={0}
                  // Pinta sempre que tem turma no slot, mesmo com 0 aluno
                  // (pedido do usuário, 2026-09-08: "a celula mesma sem
                  // ocupação precisa colocar a cor da categoria") — sem
                  // isso, uma turma vazia ficava idêntica a um horário sem
                  // turma nenhuma. fracao=0 cai no piso de 0.12 (a mesma
                  // base já usada antes só que agora sempre aplicada). A
                  // faixa lateral com a cor cheia da categoria segue o
                  // card de referência que o usuário mandou (pedido do
                  // usuário, 2026-09-09).
                  style={{
                    background: `rgba(${corBase}, ${0.12 + fracao * 0.68})`,
                    borderLeft: `3px solid rgb(${corBase})`,
                  }}
                  title={`${quadra.nome} · ${dataFormatada} ${hora}h — ${nomesCategoria} — ${alunos} de ${capacidade} vaga(s) ocupada(s). Clique pra ver os nomes.`}
                  onClick={() => setSelecionado({ quadra, data, hora, matriculasDoDia, capacidade })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelecionado({ quadra, data, hora, matriculasDoDia, capacidade });
                    }
                  }}
                >
                  <span className={fracao >= 0.6 ? "ocupacao-valor claro" : "ocupacao-valor"}>
                    {alunos}/{capacidade}
                  </span>
                </div>
              );
            }),
          ]),
        ];

        const mediaOcupacao = somaCapacidade > 0 ? Math.round((somaAlunos / somaCapacidade) * 100) : 0;

        return (
          <div key={quadra.id}>
            <div className="ocupacao-quadra-header">
              <h3>{quadra.nome}</h3>
              {/* Barra de progresso no lugar do texto solto (pedido do
                  usuário, 2026-09-09: seguir a referência de layout de
                  arena com barra de ocupação por quadra). Some no modo
                  disponibilidade (pedido do usuário, 2026-09-08) — é
                  exatamente o número que esse modo existe pra não expor. */}
              {modo === "real" && (
                <div className="ocupacao-progress" title={`${mediaOcupacao}% de ocupação nessa semana`}>
                  <div className="ocupacao-progress-track">
                    <div className="ocupacao-progress-fill" style={{ width: `${mediaOcupacao}%` }} />
                  </div>
                  <span className="ocupacao-progress-label">{mediaOcupacao}% de ocupação nessa semana</span>
                </div>
              )}
            </div>
            <div className="ocupacao-wrap">
              <div
                className="ocupacao-grid"
                style={{ gridTemplateColumns: `52px repeat(7, minmax(56px, 1fr))` }}
              >
                {celulas}
              </div>
            </div>
          </div>
        );
      })}

      {modo === "real" ? (
        <div className="ocupacao-legenda">
          <span>Vazia</span>
          <span className="ocupacao-legenda-escala">
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((op) => (
              <span key={op} style={{ background: `rgba(14, 149, 148, ${op})` }} />
            ))}
          </span>
          <span>
            Lotada — a intensidade da cor é alunos matriculados / capacidade da turma naquele dia e
            horário (a cor em si é a categoria, ver legenda acima). Clique numa célula pra ver os nomes.
          </span>
        </div>
      ) : (
        <div className="ocupacao-legenda">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--good)" }}>
            <Icon name="check-circle" size={14} /> Tem vaga
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--risk)" }}>
            <Icon name="x-circle" size={14} /> Lotado
          </span>
        </div>
      )}
    </div>
  );
}

/** Quem vai ter aula naquele dia/horário específico (pedido do usuário,
 * 2026-08-26: "dá pra ver o nome dos alunos que vão fazer aula no dia?").
 * Mesmo padrão de popup já usado no resto do app. */
function DetalhesAulaModal({
  selecionado,
  onFechar,
}: {
  selecionado: { quadra: Quadra; data: Date; hora: number; matriculasDoDia: Matricula[]; capacidade: number };
  onFechar: () => void;
}) {
  const { quadra, data, hora, matriculasDoDia, capacidade } = selecionado;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const rotuloData = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">
            {quadra.nome} · {hora}h
          </span>
          <span className="item-card-subtitle">
            {rotuloData} · {matriculasDoDia.length} de {capacidade} vaga(s) ocupada(s)
          </span>
        </div>

        {matriculasDoDia.length === 0 ? (
          <p className="empty-state" style={{ padding: 0 }}>
            Ninguém matriculado nesse dia e horário ainda.
          </p>
        ) : (
          <ul className="ocupacao-lista-alunos">
            {matriculasDoDia.map((m) => (
              <li key={m.id}>
                {m.aluno.nome} · {m.turma.modalidade.nome}
              </li>
            ))}
          </ul>
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
