export const DIAS_SEMANA: { value: string; label: string }[] = [
  { value: "segunda", label: "Seg" },
  { value: "terça", label: "Ter" },
  { value: "quarta", label: "Qua" },
  { value: "quinta", label: "Qui" },
  { value: "sexta", label: "Sex" },
  { value: "sábado", label: "Sáb" },
  { value: "domingo", label: "Dom" },
];

/** Nome sugestivo pra uma turma (pedido do usuário, 2026-08-20) — ex.:
 * "Turma 8h · Seg Ter Qua". Horário sempre é hora cheia ("HH:00"), então
 * vira só "Hh"; os dias usam a mesma abreviação já usada nos chips. */
export function rotuloTurma(diasSemana: string[], horario: string): string {
  const hora = horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
  const dias = diasSemana
    .map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label ?? d)
    .join(" ");
  return `Turma ${hora} · ${dias}`;
}

/** Horário de término dado o início + duração — "HH:MM" (pedido do
 * usuário, 2026-08-26, usado nas telas de reagendar/comprar/agenda pra
 * mostrar "10:00 – 11:00" em vez de só o início). */
export function horarioFim(horario: string, duracaoMinutos: number): string {
  const [h, m] = horario.split(":").map(Number);
  const total = h * 60 + m + duracaoMinutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Seg Ter Qua Qui Sex" — mesma abreviação já usada em rotuloTurma. Usado
 * pra mostrar o horário de funcionamento do Point (pedido do usuário,
 * 2026-08-30) — na Início do aluno e no Perfil do professor. */
export function rotuloDias(dias: string[]): string {
  return dias.map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label ?? d).join(" ");
}

/** "8h–20h" a partir da lista de horários de hora cheia cadastrados —
 * pega o primeiro e o último e soma 1h no fim (mesma janela de hora
 * cheia usada na criação de turma; não dá pra saber a duração real do
 * expediente, só até que hora começa o último horário disponível). */
export function faixaHorario(horarios: string[]): string {
  if (horarios.length === 0) return "";
  const horas = horarios.map((h) => Number(h.slice(0, 2))).sort((a, b) => a - b);
  return `${horas[0]}h–${horas[horas.length - 1] + 1}h`;
}
