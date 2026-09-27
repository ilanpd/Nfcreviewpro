/**
 * Dia local de uma empresa (ADR-078). O brinde libera "amanhã" e vence numa
 * data que o cliente lê na tela, então o dia precisa ser o do fuso da
 * empresa, não o do servidor (que roda em UTC). Sem biblioteca: só `Intl`.
 */

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(timeZone: string, instantMs: number): LocalParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute, second: out.second };
}

/** Diferença, em ms, entre a hora local do fuso e o UTC no instante dado. */
function offsetMs(timeZone: string, instantMs: number): number {
  const p = partsIn(timeZone, instantMs);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Descarta os milissegundos do instante: o formatter só enxerga segundos.
  return localAsUtc - Math.floor(instantMs / 1000) * 1000;
}

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** O dia do calendário em que `instant` cai no fuso dado. */
export function localDay(instant: Date, timeZone: string): CalendarDay {
  const { year, month, day } = partsIn(timeZone, instant.getTime());
  return { year, month, day };
}

/** Soma `days` dias corridos a uma data de calendário (resolve virada de mês e de ano). */
export function addCalendarDays(day: CalendarDay, days: number): CalendarDay {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** O instante (UTC) em que começa o dia local `day` no fuso dado. */
export function startOfLocalDay(day: CalendarDay, timeZone: string): Date {
  const naive = Date.UTC(day.year, day.month - 1, day.day, 0, 0, 0);
  const first = naive - offsetMs(timeZone, naive);
  // Uma segunda passada cobre o caso em que o deslocamento muda entre o palpite
  // e o instante real (fusos com horário de verão).
  const second = naive - offsetMs(timeZone, first);
  return new Date(second);
}

/** Início do dia seguinte, no fuso dado. */
export function startOfNextLocalDay(now: Date, timeZone: string): Date {
  return startOfLocalDay(addCalendarDays(localDay(now, timeZone), 1), timeZone);
}

/** Início do dia local que fica `days` dias depois de `from`, no fuso dado. */
export function startOfLocalDayAfter(from: CalendarDay, days: number, timeZone: string): Date {
  return startOfLocalDay(addCalendarDays(from, days), timeZone);
}

/** "09/10" para um instante, no fuso dado: a data que o cliente lê na tela. */
export function formatDayMonth(instant: Date, timeZone: string): string {
  const { day, month } = localDay(instant, timeZone);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}
