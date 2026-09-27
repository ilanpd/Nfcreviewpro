import { describe, expect, it } from "vitest";
import { addCalendarDays, formatDayMonth, localDay, startOfLocalDay, startOfLocalDayAfter, startOfNextLocalDay } from "./time";

const SP = "America/Sao_Paulo"; // UTC-3, sem horário de verão desde 2019
const NY = "America/New_York"; // UTC-5 / UTC-4 com horário de verão
const IN = "Asia/Kolkata"; // UTC+5:30

const iso = (d: Date) => d.toISOString();

describe("localDay", () => {
  it("o dia depende do fuso, não do UTC", () => {
    // 02:00Z de 26/09 ainda é 25/09 às 23h em São Paulo.
    expect(localDay(new Date("2026-09-26T02:00:00Z"), SP)).toEqual({ year: 2026, month: 9, day: 25 });
    expect(localDay(new Date("2026-09-26T03:00:00Z"), SP)).toEqual({ year: 2026, month: 9, day: 26 });
  });
});

describe("addCalendarDays", () => {
  it("vira o mês e o ano", () => {
    expect(addCalendarDays({ year: 2026, month: 9, day: 26 }, 14)).toEqual({ year: 2026, month: 10, day: 10 });
    expect(addCalendarDays({ year: 2026, month: 12, day: 26 }, 14)).toEqual({ year: 2027, month: 1, day: 9 });
    expect(addCalendarDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(addCalendarDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });
});

describe("startOfLocalDay", () => {
  it("meia-noite de São Paulo é 03:00 UTC", () => {
    expect(iso(startOfLocalDay({ year: 2026, month: 9, day: 26 }, SP))).toBe("2026-09-26T03:00:00.000Z");
  });

  it("fuso com meia hora de deslocamento", () => {
    expect(iso(startOfLocalDay({ year: 2026, month: 9, day: 26 }, IN))).toBe("2026-09-25T18:30:00.000Z");
  });

  it("horário de verão: o mesmo fuso tem deslocamentos diferentes em dias diferentes", () => {
    // 08/03/2026 começa em EST (UTC-5); 09/03/2026 já é EDT (UTC-4).
    expect(iso(startOfLocalDay({ year: 2026, month: 3, day: 8 }, NY))).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(startOfLocalDay({ year: 2026, month: 3, day: 9 }, NY))).toBe("2026-03-09T04:00:00.000Z");
    // Volta ao EST em 01/11/2026.
    expect(iso(startOfLocalDay({ year: 2026, month: 11, day: 1 }, NY))).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(startOfLocalDay({ year: 2026, month: 11, day: 2 }, NY))).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("startOfNextLocalDay", () => {
  it("de tarde, o dia seguinte começa à meia-noite local", () => {
    expect(iso(startOfNextLocalDay(new Date("2026-09-25T17:32:00Z"), SP))).toBe("2026-09-26T03:00:00.000Z");
  });

  it("logo antes da meia-noite local ainda é o mesmo dia", () => {
    expect(iso(startOfNextLocalDay(new Date("2026-09-26T02:59:59Z"), SP))).toBe("2026-09-26T03:00:00.000Z");
  });

  it("exatamente à meia-noite local já é o dia novo, então o seguinte é o de amanhã", () => {
    expect(iso(startOfNextLocalDay(new Date("2026-09-26T03:00:00Z"), SP))).toBe("2026-09-27T03:00:00.000Z");
  });

  it("atravessa a mudança de horário de verão", () => {
    expect(iso(startOfNextLocalDay(new Date("2026-03-08T12:00:00Z"), NY))).toBe("2026-03-09T04:00:00.000Z");
  });
});

describe("startOfLocalDayAfter / formatDayMonth", () => {
  it("N dias depois de um dia do calendário", () => {
    expect(iso(startOfLocalDayAfter({ year: 2026, month: 9, day: 26 }, 14, SP))).toBe("2026-10-10T03:00:00.000Z");
  });

  it("formata dia/mês no fuso, com zero à esquerda", () => {
    expect(formatDayMonth(new Date("2026-10-09T15:00:00Z"), SP)).toBe("09/10");
    expect(formatDayMonth(new Date("2026-01-05T01:00:00Z"), SP)).toBe("04/01");
  });
});
