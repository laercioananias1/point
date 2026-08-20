import { DIAS_SEMANA } from "../lib/dias";

export interface CalendarItem {
  id: number;
  diaSemana: string;
  horario: string; // "HH:00"
  duracaoMinutos: number;
  titulo: string;
  subtitulo?: string;
}

const HORA_INICIAL = 5;
const HORA_FINAL = 23;

/** Agenda semanal — dias nas colunas, horas cheias nas linhas. Cada item ocupa
 * quantas linhas a duração da aula exigir (uma aula de 90min cobre 1h30). */
export function WeeklyCalendar({ items }: { items: CalendarItem[] }) {
  const horas = Array.from({ length: HORA_FINAL - HORA_INICIAL + 1 }, (_, i) => HORA_INICIAL + i);

  return (
    <div className="calendar-wrap">
      <div
        className="calendar-grid"
        style={{ gridTemplateRows: `auto repeat(${horas.length}, minmax(40px, auto))` }}
      >
        <div className="calendar-cell calendar-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {DIAS_SEMANA.map((d, colIdx) => (
          <div
            className="calendar-cell calendar-day-header"
            key={d.value}
            style={{ gridRow: 1, gridColumn: colIdx + 2 }}
          >
            {d.label}
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
          ...DIAS_SEMANA.map((d, colIdx) => (
            <div
              key={`slot-${hora}-${d.value}`}
              className="calendar-cell calendar-slot"
              style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }}
            />
          )),
        ])}

        {items.map((item) => {
          const diaIdx = DIAS_SEMANA.findIndex((d) => d.value === item.diaSemana);
          const hora = Number(item.horario.split(":")[0]);
          if (diaIdx === -1 || hora < HORA_INICIAL || hora > HORA_FINAL) return null;
          const rowStart = hora - HORA_INICIAL + 2;
          const rowSpan = Math.max(1, Math.round(item.duracaoMinutos / 60));

          return (
            <div
              key={item.id}
              className="calendar-item"
              style={{ gridRow: `${rowStart} / span ${rowSpan}`, gridColumn: diaIdx + 2 }}
            >
              <span className="calendar-item-title">{item.titulo}</span>
              {item.subtitulo && <span className="calendar-item-subtitle">{item.subtitulo}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
