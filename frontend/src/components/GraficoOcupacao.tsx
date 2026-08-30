import { useEffect, useState } from "react";
import type { Matricula, Quadra, TurmaResumo } from "../api/types";
import { DIAS_SEMANA } from "../lib/dias";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";

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
                return <div className="ocupacao-cell ocupacao-slot" key={`${iso}-${hora}`} />;
              }
              const matriculasDoDia = turmasSlot.flatMap((t) => matriculasNaData(t.id, data));
              const alunos = matriculasDoDia.length;
              const capacidade = turmasSlot.reduce((soma, t) => soma + t.capacidade, 0);
              somaAlunos += alunos;
              somaCapacidade += capacidade;
              const fracao = capacidade > 0 ? alunos / capacidade : 0;
              return (
                <div
                  className="ocupacao-cell ocupacao-slot ocupacao-slot-clicavel"
                  key={`${iso}-${hora}`}
                  role="button"
                  tabIndex={0}
                  // RGB 14,149,148 == var(--accent) — não dá pra variar
                  // opacidade de uma custom property direto no style.
                  style={
                    fracao > 0 ? { background: `rgba(14, 149, 148, ${0.12 + fracao * 0.68})` } : undefined
                  }
                  title={`${quadra.nome} · ${new Date(iso + "T00:00").toLocaleDateString("pt-BR")} ${hora}h — ${alunos} de ${capacidade} vaga(s) ocupada(s). Clique pra ver os nomes.`}
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
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
              {quadra.nome}{" "}
              <span className="empty-state" style={{ display: "inline", padding: 0, fontSize: 13 }}>
                — {mediaOcupacao}% de ocupação nessa semana
              </span>
            </h3>
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

      <div className="ocupacao-legenda">
        <span>Vazia</span>
        <span className="ocupacao-legenda-escala">
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((op) => (
            <span key={op} style={{ background: `rgba(14, 149, 148, ${op})` }} />
          ))}
        </span>
        <span>Lotada — alunos matriculados / capacidade da turma naquele dia e horário. Clique numa célula
          pra ver os nomes.</span>
      </div>
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
