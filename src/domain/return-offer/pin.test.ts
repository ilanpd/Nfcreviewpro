import { describe, expect, it } from "vitest";
import { PIN_ATTEMPT_WINDOW_MS, PIN_MAX_FAILURES, evaluatePinAttempts, isValidPinFormat, isWeakPin } from "./pin";
import { offerAvailability } from "./availability";

describe("isValidPinFormat", () => {
  it.each(["0000", "4821", "9999"])("aceita %s", (pin) => expect(isValidPinFormat(pin)).toBe(true));
  it.each(["", "123", "12345", "12a4", "12 4", "١٢٣٤"])("recusa %j", (pin) => expect(isValidPinFormat(pin)).toBe(false));
});

describe("isWeakPin", () => {
  it.each(["0000", "1111", "9999", "1234", "2345", "6789", "4321", "9876", "3210"])("%s é fraco demais", (pin) => {
    expect(isWeakPin(pin)).toBe(true);
  });
  it.each(["4821", "1357", "2468", "1212", "1123", "7391"])("%s é aceitável", (pin) => {
    expect(isWeakPin(pin)).toBe(false);
  });
  it("formato inválido conta como fraco", () => {
    expect(isWeakPin("12")).toBe(true);
  });
});

describe("evaluatePinAttempts", () => {
  const NOW = new Date("2026-09-25T18:00:00Z");
  const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

  it("sem falhas: todas as tentativas disponíveis", () => {
    expect(evaluatePinAttempts({ failures: [], now: NOW })).toEqual({ allowed: true, remaining: PIN_MAX_FAILURES });
  });

  it("conta só as falhas dentro da janela de 10 minutos", () => {
    const result = evaluatePinAttempts({ failures: [ago(1), ago(2), ago(30)], now: NOW });
    expect(result).toEqual({ allowed: true, remaining: 3 });
  });

  it("na quinta falha da janela, bloqueia até a falha que bloqueia sair da janela", () => {
    const failures = [ago(9), ago(7), ago(5), ago(3), ago(1)];
    const result = evaluatePinAttempts({ failures, now: NOW });
    expect(result).toEqual({ allowed: false, retryAt: new Date(ago(9).getTime() + PIN_ATTEMPT_WINDOW_MS) });
  });

  it("falhas fora de ordem dão o mesmo resultado", () => {
    const failures = [ago(1), ago(9), ago(3), ago(7), ago(5)];
    expect(evaluatePinAttempts({ failures, now: NOW }).allowed).toBe(false);
  });

  it("depois que a falha mais antiga sai da janela, volta a permitir", () => {
    const failures = [ago(11), ago(7), ago(5), ago(3), ago(1)];
    expect(evaluatePinAttempts({ failures, now: NOW })).toEqual({ allowed: true, remaining: 1 });
  });

  it("aceita limites personalizados", () => {
    const result = evaluatePinAttempts({ failures: [ago(1), ago(2)], now: NOW, maxFailures: 2, windowMs: 5 * 60 * 1000 });
    expect(result).toEqual({ allowed: false, retryAt: new Date(ago(2).getTime() + 5 * 60 * 1000) });
  });
});

describe("offerAvailability", () => {
  const ok = { globalEnabled: true, pilotEnabled: true, tierAllowsReturn: true, offerActive: true, hasPin: true };

  it("tudo em ordem: disponível", () => {
    expect(offerAvailability(ok)).toEqual({ available: true });
  });

  it.each([
    ["KILL_SWITCH", { globalEnabled: false }],
    ["NOT_IN_PILOT", { pilotEnabled: false }],
    ["PLAN_NOT_ALLOWED", { tierAllowsReturn: false }],
    ["PAUSED", { offerActive: false }],
    ["NO_PIN", { hasPin: false }],
  ])("motivo %s", (reason, patch) => {
    expect(offerAvailability({ ...ok, ...patch })).toEqual({ available: false, reason });
  });

  it("com vários motivos, vale o de quem manda primeiro: interruptor geral, piloto, plano, pausa, PIN", () => {
    const everythingOff = { globalEnabled: false, pilotEnabled: false, tierAllowsReturn: false, offerActive: false, hasPin: false };
    expect(offerAvailability(everythingOff)).toMatchObject({ reason: "KILL_SWITCH" });
    expect(offerAvailability({ ...everythingOff, globalEnabled: true })).toMatchObject({ reason: "NOT_IN_PILOT" });
    expect(offerAvailability({ ...everythingOff, globalEnabled: true, pilotEnabled: true })).toMatchObject({ reason: "PLAN_NOT_ALLOWED" });
    expect(offerAvailability({ ...everythingOff, globalEnabled: true, pilotEnabled: true, tierAllowsReturn: true })).toMatchObject({
      reason: "PAUSED",
    });
  });
});
