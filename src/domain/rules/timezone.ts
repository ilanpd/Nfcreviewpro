const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalDateParts {
  /** 0 = Sunday .. 6 = Saturday, in the given timezone — NOT the server's. */
  weekday: number;
  hour: number;
  minute: number;
  /** YYYY-MM-DD in the given timezone. */
  isoDate: string;
}

/**
 * Timezone-aware date decomposition using the native Intl API — no date
 * library dependency. A "Friday 18:00" rule must mean 6pm in the business's
 * timezone, not the server's (Vercel runs UTC); near a day boundary, the
 * weekday itself can differ between UTC and local time, which is exactly
 * the class of bug this exists to avoid.
 */
export function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12: false formats midnight as "24" in some ICU implementations —
  // normalize back to 0 so comparisons against "00:00" behave as expected.
  const hour = Number(get("hour")) % 24;

  return {
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    hour,
    minute: Number(get("minute")),
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
  };
}
