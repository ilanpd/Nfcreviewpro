import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportServerMessage } = vi.hoisted(() => ({ reportServerMessage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./report-error", () => ({ reportServerMessage }));

import { log } from "./logger";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("log.error também vai ao Sentry", () => {
  it("manda a mensagem com o módulo e os campos (o filtro de dados pessoais roda lá dentro)", () => {
    log.error("stripe-webhook", "Falha ao provisionar StoreOrder", { sessionId: "cs_1", error: "boom" });
    expect(reportServerMessage).toHaveBeenCalledTimes(1);
    expect(reportServerMessage).toHaveBeenCalledWith("Falha ao provisionar StoreOrder", {
      module: "stripe-webhook",
      extra: { sessionId: "cs_1", error: "boom" },
    });
  });

  it("continua escrevendo a linha estruturada no console (o log da Vercel não muda)", () => {
    log.error("email", "Falha ao enviar e-mail", { error: "x" });
    expect(console.error).toHaveBeenCalledTimes(1);
    const line = JSON.parse((console.error as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(line).toMatchObject({ level: "error", module: "email", message: "Falha ao enviar e-mail", error: "x" });
  });

  it("funciona sem campos", () => {
    log.error("workers", "Falhou");
    expect(reportServerMessage).toHaveBeenCalledWith("Falhou", { module: "workers", extra: undefined });
  });
});

describe("os outros níveis NÃO vão ao Sentry", () => {
  it.each(["debug", "info", "warn"] as const)("%s só escreve no console", (level) => {
    log[level]("modulo", "mensagem", { a: 1 });
    expect(reportServerMessage).not.toHaveBeenCalled();
  });
});
