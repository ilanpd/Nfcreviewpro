import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` é içado para o topo do arquivo: os mocks precisam existir antes disso.
const { scope, sentry, after } = vi.hoisted(() => {
  const scope = { setTag: vi.fn(), setExtras: vi.fn() };
  const sentry = {
    withScope: vi.fn((cb: (s: typeof scope) => void) => cb(scope)),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    flush: vi.fn(async () => true),
  };
  return { scope, sentry, after: vi.fn() };
});
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("next/server", () => ({ after: (cb: () => void) => after(cb) }));

import { reportServerError, reportServerMessage, sentryConfigured } from "./report-error";

const OLD_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://chave@o0.ingest.sentry.io/1";
});
afterEach(() => {
  if (OLD_DSN === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = OLD_DSN;
});

describe("sem DSN configurado: tudo é no-op", () => {
  it("não captura nem faz nenhuma chamada ao SDK", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(sentryConfigured()).toBe(false);
    expect(reportServerError(new Error("x"))).toBe(false);
    expect(reportServerMessage("x")).toBe(false);
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
});

describe("reportServerError", () => {
  it("captura o erro com o módulo como etiqueta e os ids como extras", () => {
    const err = new Error("falhou");
    expect(reportServerError(err, { module: "api", extra: { companyId: "c1" } })).toBe(true);
    expect(scope.setTag).toHaveBeenCalledWith("module", "api");
    expect(scope.setExtras).toHaveBeenCalledWith({ companyId: "c1" });
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("transforma um valor que não é Error num Error (para ter pilha e mensagem)", () => {
    reportServerError("texto solto");
    const arg = sentry.captureException.mock.calls[0][0] as Error;
    expect(arg).toBeInstanceOf(Error);
    expect(arg.message).toBe("texto solto");
  });

  it("não define etiqueta nem extras quando não há contexto", () => {
    reportServerError(new Error("x"));
    expect(scope.setTag).not.toHaveBeenCalled();
    expect(scope.setExtras).not.toHaveBeenCalled();
  });

  it("agenda o envio com after() para a função serverless não congelar antes", () => {
    reportServerError(new Error("x"));
    expect(after).toHaveBeenCalledTimes(1);
    // o callback agendado é o flush do Sentry
    const cb = after.mock.calls[0][0] as () => unknown;
    cb();
    expect(sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("fora de uma requisição (after lança), cai no flush direto", () => {
    after.mockImplementationOnce(() => {
      throw new Error("after fora do escopo da requisição");
    });
    expect(() => reportServerError(new Error("x"))).not.toThrow();
    expect(sentry.flush).toHaveBeenCalledWith(2000);
  });
});

describe("reportServerMessage", () => {
  it("manda como nível error, com módulo e extras", () => {
    reportServerMessage("Falha ao provisionar", { module: "stripe-webhook", extra: { sessionId: "cs_1" } });
    expect(sentry.captureMessage).toHaveBeenCalledWith("Falha ao provisionar", {
      level: "error",
      tags: { module: "stripe-webhook" },
      extra: { sessionId: "cs_1" },
    });
    expect(after).toHaveBeenCalledTimes(1);
  });
});
