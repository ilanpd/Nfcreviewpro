import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem as variáveis do Upstash, `lib/redis` exporta null e o limitador usa a memória (o mesmo código de decisão).
vi.mock("./redis", () => ({ redis: null }));

import { rateLimit, rateLimitHeaders, tooManyRequestsResponse, withConcurrencyLimit } from "./rate-limit";

let n = 0;
const uniqueId = () => `teste-${Date.now()}-${n++}`;

describe("rateLimit (memória)", () => {
  it("deixa passar até o limite e recusa a partir dele, com limit/remaining/reset coerentes", async () => {
    const id = uniqueId();
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await rateLimit("exportHeavy", id)); // exportHeavy = 6 por minuto
    expect(results.slice(0, 6).every((r) => r.success)).toBe(true);
    expect(results[6].success).toBe(false);
    expect(results[0].limit).toBe(6);
    expect(results[0].remaining).toBe(5);
    expect(results[5].remaining).toBe(0);
    expect(results[6].remaining).toBe(0);
    expect(results[6].reset).toBeGreaterThan(Date.now());
    expect(results[6].reset).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it("cada identificador (IP ou usuário) tem a sua cota", async () => {
    const a = uniqueId();
    const b = uniqueId();
    for (let i = 0; i < 7; i++) await rateLimit("exportHeavy", a);
    expect((await rateLimit("exportHeavy", a)).success).toBe(false);
    expect((await rateLimit("exportHeavy", b)).success).toBe(true);
  });

  it("cada classe tem a sua cota (esgotar uma não derruba a outra)", async () => {
    const id = uniqueId();
    for (let i = 0; i < 7; i++) await rateLimit("exportHeavy", id);
    expect((await rateLimit("exportHeavy", id)).success).toBe(false);
    expect((await rateLimit("apiRead", id)).success).toBe(true);
  });

  it("as classes novas têm os tetos da política", async () => {
    const id = uniqueId();
    expect((await rateLimit("apiRead", id)).limit).toBe(300);
    expect((await rateLimit("authMutationIp", id)).limit).toBe(600);
    expect((await rateLimit("publicData", id)).limit).toBe(60);
    expect((await rateLimit("publicImage", id)).limit).toBe(120);
    expect((await rateLimit("personalLink", id)).limit).toBe(30);
  });
});

describe("rateLimitHeaders e tooManyRequestsResponse", () => {
  it("dentro do limite: só RateLimit-*, sem Retry-After", () => {
    const h = rateLimitHeaders({ success: true, remaining: 9, limit: 10, reset: Date.now() + 30_000 });
    expect(h["RateLimit-Limit"]).toBe("10");
    expect(h["RateLimit-Remaining"]).toBe("9");
    expect(Number(h["RateLimit-Reset"])).toBeGreaterThan(0);
    expect(h["Retry-After"]).toBeUndefined();
  });

  it("estourou: traz Retry-After em segundos (mínimo 1)", () => {
    const h = rateLimitHeaders({ success: false, remaining: 0, limit: 10, reset: Date.now() + 12_300 });
    expect(Number(h["Retry-After"])).toBeGreaterThanOrEqual(12);
    expect(Number(h["Retry-After"])).toBeLessThanOrEqual(13);
    expect(rateLimitHeaders({ success: false, remaining: 0, limit: 10, reset: Date.now() - 5000 })["Retry-After"]).toBe("1");
  });

  it("remaining nunca fica negativo", () => {
    expect(rateLimitHeaders({ success: false, remaining: -4, limit: 10, reset: Date.now() + 1000 })["RateLimit-Remaining"]).toBe("0");
  });

  it("a resposta 429 leva o corpo em português e os cabeçalhos", async () => {
    const res = tooManyRequestsResponse({ success: false, remaining: 0, limit: 10, reset: Date.now() + 5000 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("RateLimit-Limit")).toBe("10");
    expect((await res.json()).error).toMatch(/Muitas requisições/);
  });
});

describe("withConcurrencyLimit (memória)", () => {
  beforeEach(() => vi.useRealTimers());

  const gate = () => {
    let release!: () => void;
    const promise = new Promise<void>((r) => (release = r));
    return { promise, release };
  };

  it("recusa a execução que passa do máximo simultâneo e libera a vaga ao terminar", async () => {
    const id = uniqueId();
    const g1 = gate();
    const g2 = gate();
    const first = withConcurrencyLimit("x", id, 2, async () => (await g1.promise, "a"));
    const second = withConcurrencyLimit("x", id, 2, async () => (await g2.promise, "b"));
    await Promise.resolve(); // deixa as duas começarem

    const third = await withConcurrencyLimit("x", id, 2, async () => "c");
    expect(third.ok).toBe(false); // a terceira simultânea é recusada

    g1.release();
    expect(await first).toEqual({ ok: true, value: "a" });
    const fourth = await withConcurrencyLimit("x", id, 2, async () => "d");
    expect(fourth).toEqual({ ok: true, value: "d" }); // a vaga voltou

    g2.release();
    expect(await second).toEqual({ ok: true, value: "b" });
  });

  it("libera a vaga mesmo quando a operação lança erro", async () => {
    const id = uniqueId();
    await expect(
      withConcurrencyLimit("x", id, 1, async () => {
        throw new Error("falhou");
      })
    ).rejects.toThrow("falhou");
    expect((await withConcurrencyLimit("x", id, 1, async () => "ok")).ok).toBe(true);
  });

  it("o limite é por identificador: outro usuário não é afetado", async () => {
    const a = uniqueId();
    const b = uniqueId();
    const g = gate();
    const running = withConcurrencyLimit("x", a, 1, async () => (await g.promise, 1));
    await Promise.resolve();
    expect((await withConcurrencyLimit("x", a, 1, async () => 2)).ok).toBe(false);
    expect((await withConcurrencyLimit("x", b, 1, async () => 3)).ok).toBe(true);
    g.release();
    await running;
  });
});
