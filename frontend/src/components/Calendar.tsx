import { useMemo, useState } from "react";
import { DIAS_SEMANA } from "../lib/dias";

export interface CalendarItem {
  id: number;
  diaSemana: string; // "segunda".."domingo"
  horario: string; // "HH:00"
  duracaoMinutos: number;
  periodoInicio: string; // "YYYY-MM-DD"
  periodoFim: string | null; // "YYYY-MM-DD" — null = recorrente, sem fim
  excecoes?: string[]; // datas "YYYY-MM-DD" removidas dessa recorrência
  titulo: string;
  subtitulo?: string;
}

type Modo = "dia" | "semana" | "mes";

const HORA_INICIAL = 5;
const HORA_FINAL = 23;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function diaSemanaDeData(date: Date): string {
  return DIAS_SEMANA[(date.getDay() + 6) % 7].value;
}

function ocorreNaData(item: CalendarItem, date: Date): boolean {
  const iso = toISODate(date);
  const dentroDoPeriodo = iso >= item.periodoInicio && (item.periodoFim === null || iso <= item.periodoFim);
  const removida = item.excecoes?.includes(iso) ?? false;
  return item.diaSemana === diaSemanaDeData(date) && dentroDoPeriodo && !removida;
}

export interface Ocorrencia {
  item: CalendarItem;
  data: Date;
}

/** As próximas N ocorrências (de hoje em diante, incluindo hoje) entre
 * várias recorrências — pedido do usuário, 2026-08-25: lista compacta de
 * "próximos agendamentos" na home do aluno, sem precisar abrir o
 * calendário inteiro pra ver o que vem por aí. Varre dia a dia (até um
 * teto de `limiteDias`, pra não rodar pra sempre se não sobrar nenhuma
 * ocorrência futura) e ordena por horário dentro de cada dia. */
export function proximasOcorrencias(
  items: CalendarItem[],
  apartirDe: Date,
  quantidade: number,
  limiteDias = 120,
): Ocorrencia[] {
  const resultado: Ocorrencia[] = [];
  let cursor = new Date(apartirDe.getFullYear(), apartirDe.getMonth(), apartirDe.getDate());
  let diasVerificados = 0;

  while (resultado.length < quantidade && diasVerificados < limiteDias) {
    const doDia = items
      .filter((item) => ocorreNaData(item, cursor))
      .sort((a, b) => a.horario.localeCompare(b.horario));
    for (const item of doDia) {
      if (resultado.length >= quantidade) break;
      resultado.push({ item, data: new Date(cursor) });
    }
    cursor = somarDias(cursor, 1);
    diasVerificados += 1;
  }

  return resultado;
}

export function inicioDaSemana(ref: Date): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function somarDias(ref: Date, dias: number): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() + dias);
  return d;
}

function navegar(ref: Date, modo: Modo, direcao: 1 | -1): Date {
  if (modo === "dia") return somarDias(ref, direcao);
  if (modo === "semana") return somarDias(ref, direcao * 7);
  const d = new Date(ref);
  d.setMonth(d.getMonth() + direcao);
  return d;
}

function tituloPeriodo(ref: Date, modo: Modo): string {
  if (modo === "mes") {
    const texto = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  if (modo === "dia") {
    const texto = ref.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const inicio = inicioDaSemana(ref);
  const fim = somarDias(inicio, 6);
  const dia = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit" });
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" });
  return inicio.getMonth() === fim.getMonth()
    ? `${dia(inicio)}–${dia(fim)} de ${mes(fim)}`
    : `${dia(inicio)} de ${mes(inicio)} – ${dia(fim)} de ${mes(fim)}`;
}

/** Agenda de turmas com navegação dia/semana/mês. As turmas são recorrências
 * semanais (dia_semana + horário, entre periodo_inicio e periodo_fim) — este
 * componente "expande" essa recorrência pras datas de calendário visíveis.
 * Passando onItemClick, cada ocorrência renderizada vira clicável — é o que
 * a tela do Professor usa pra abrir a edição/remoção (pedido do usuário,
 * 2026-08-20: "o melhor local pra remover seria dentro do calendário"). */
export function Calendar({
  items,
  onItemClick,
}: {
  items: CalendarItem[];
  onItemClick?: (item: CalendarItem, data: Date) => void;
}) {
  const [modo, setModo] = useState<Modo>("semana");
  const [referencia, setReferencia] = useState(new Date());

  const hoje = new Date();

  return (
    <div>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button className="secondary" onClick={() => setReferencia((r) => navegar(r, modo, -1))}>
            ‹
          </button>
          <button className="secondary" onClick={() => setReferencia(new Date())}>
            Hoje
          </button>
          <button className="secondary" onClick={() => setReferencia((r) => navegar(r, modo, 1))}>
            ›
          </button>
          <span className="calendar-title">{tituloPeriodo(referencia, modo)}</span>
        </div>
        <div className="view-switch">
          {(["dia", "semana", "mes"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              className={modo === m ? "view-switch-btn active" : "view-switch-btn"}
              onClick={() => setModo(m)}
            >
              {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {modo === "mes" && (
        <MesView referencia={referencia} items={items} hoje={hoje} onItemClick={onItemClick} />
      )}
      {modo === "semana" && (
        <DiasView datas={diasDaSemana(referencia)} items={items} hoje={hoje} onItemClick={onItemClick} />
      )}
      {modo === "dia" && (
        <DiasView datas={[referencia]} items={items} hoje={hoje} onItemClick={onItemClick} />
      )}
    </div>
  );
}

function diasDaSemana(ref: Date): Date[] {
  const inicio = inicioDaSemana(ref);
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

function DiasView({
  datas,
  items,
  hoje,
  onItemClick,
}: {
  datas: Date[];
  items: CalendarItem[];
  hoje: Date;
  onItemClick?: (item: CalendarItem, data: Date) => void;
}) {
  const horas = Array.from({ length: HORA_FINAL - HORA_INICIAL + 1 }, (_, i) => HORA_INICIAL + i);
  const colunas = datas.length;

  return (
    <div className="calendar-wrap">
      <div
        className="calendar-grid"
        style={{
          gridTemplateColumns: `52px repeat(${colunas}, minmax(96px, 1fr))`,
          gridTemplateRows: `auto repeat(${horas.length}, minmax(40px, auto))`,
        }}
      >
        <div className="calendar-cell calendar-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {datas.map((data, colIdx) => (
          <div
            className={
              toISODate(data) === toISODate(hoje)
                ? "calendar-cell calendar-day-header today"
                : "calendar-cell calendar-day-header"
            }
            key={colIdx}
            style={{ gridRow: 1, gridColumn: colIdx + 2 }}
          >
            {DIAS_SEMANA[(data.getDay() + 6) % 7].label} {data.getDate()}
          </div>
        ))}

        {horas.flatMap((hora, rowIdx) => [
          <div
            key={`h-${hora}`}
            className="calendar-cell calendar-hour-label"
            style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
          >
            {hora}h
          </div>,
          ...datas.map((_, colIdx) => (
            <div
              key={`slot-${hora}-${colIdx}`}
              className="calendar-cell calendar-slot"
              style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }}
            />
          )),
        ])}

        {datas.flatMap((data, colIdx) =>
          items
            .filter((item) => ocorreNaData(item, data))
            .map((item) => {
              const hora = Number(item.horario.split(":")[0]);
              if (hora < HORA_INICIAL || hora > HORA_FINAL) return null;
              const rowStart = hora - HORA_INICIAL + 2;
              const rowSpan = Math.max(1, Math.round(item.duracaoMinutos / 60));
              const clicavel = Boolean(onItemClick);
              return (
                <div
                  key={`${item.id}-${colIdx}`}
                  className={clicavel ? "calendar-item calendar-item-clickable" : "calendar-item"}
                  role={clicavel ? "button" : undefined}
                  tabIndex={clicavel ? 0 : undefined}
                  onClick={clicavel ? () => onItemClick?.(item, data) : undefined}
                  onKeyDown={
                    clicavel
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") onItemClick?.(item, data);
                        }
                      : undefined
                  }
                  style={{ gridRow: `${rowStart} / span ${rowSpan}`, gridColumn: colIdx + 2 }}
                >
                  <span className="calendar-item-title">{item.titulo}</span>
                  {item.subtitulo && <span className="calendar-item-subtitle">{item.subtitulo}</span>}
                </div>
              );
            }),
        )}
      </div>
    </div>
  );
}

function MesView({
  referencia,
  items,
  hoje,
  onItemClick,
}: {
  referencia: Date;
  items: CalendarItem[];
  hoje: Date;
  onItemClick?: (item: CalendarItem, data: Date) => void;
}) {
  const dias = useMemo(() => {
    const primeiroDoMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    const inicio = inicioDaSemana(primeiroDoMes);
    return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
  }, [referencia]);

  return (
    <div className="calendar-wrap">
      <div className="month-grid">
        {DIAS_SEMANA.map((d) => (
          <div className="month-weekday-header" key={d.value}>
            {d.label}
          </div>
        ))}

        {dias.map((data, i) => {
          const foraDoMes = data.getMonth() !== referencia.getMonth();
          const ocorrencias = items.filter((item) => ocorreNaData(item, data));
          const visiveis = ocorrencias.slice(0, 3);
          const restantes = ocorrencias.length - visiveis.length;

          return (
            <div
              key={i}
              className={
                toISODate(data) === toISODate(hoje)
                  ? "month-cell today"
                  : foraDoMes
                    ? "month-cell outside"
                    : "month-cell"
              }
            >
              <span className="month-day-number">{data.getDate()}</span>
              {visiveis.map((item) =>
                onItemClick ? (
                  <button
                    type="button"
                    className="month-event month-event-clickable"
                    key={item.id}
                    onClick={() => onItemClick(item, data)}
                  >
                    {item.horario} {item.titulo}
                  </button>
                ) : (
                  <span className="month-event" key={item.id}>
                    {item.horario} {item.titulo}
                  </span>
                ),
              )}
              {restantes > 0 && <span className="month-more">+{restantes} mais</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
