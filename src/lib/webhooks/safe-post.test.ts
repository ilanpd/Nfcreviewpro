import { describe, expect, it, vi } from "vitest";
import { createGuardedLookup, postToWebhook, WebhookTargetBlockedError, type ResolvedAddress } from "./safe-post";

// `safe-post` importa `server-only`, que estoura fora do Next.
vi.mock("server-only", () => ({}));

/** Chama o `lookup` como o `net.connect` faz e devolve o que o callback recebeu. */
function runLookup(resolved: ResolvedAddress[] | Error, options: { all?: boolean; family?: number } = {}) {
  const lookup = createGuardedLookup(async () => {
    if (resolved instanceof Error) throw resolved;
    return resolved;
  });
  return new Promise<{ err: Error | null; address?: unknown; family?: number }>((resolve) => {
    lookup("exemplo.com", options, (err, address, family) => resolve({ err, address, family }));
  });
}

describe("createGuardedLookup", () => {
  it("deixa passar um domínio que resolve para IP público", async () => {
    const r = await runLookup([{ address: "93.184.216.34", family: 4 }]);
    expect(r.err).toBeNull();
    expect(r.address).toBe("93.184.216.34");
    expect(r.family).toBe(4);
  });

  it("devolve a lista inteira quando o socket pede `all`", async () => {
    const r = await runLookup(
      [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:2800:220:1::1", family: 6 },
      ],
      { all: true }
    );
    expect(r.err).toBeNull();
    expect(r.address).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1::1", family: 6 },
    ]);
  });

  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.9"])(
    "recusa um domínio público que aponta para %s (DNS apontando para dentro)",
    async (ip) => {
      const r = await runLookup([{ address: ip, family: 4 }]);
      expect(r.err).toBeInstanceOf(WebhookTargetBlockedError);
      expect(r.address).toBeUndefined();
    }
  );

  it("recusa IPv6 interno e IPv4 mapeado em IPv6", async () => {
    expect((await runLookup([{ address: "::1", family: 6 }])).err).toBeInstanceOf(WebhookTargetBlockedError);
    expect((await runLookup([{ address: "::ffff:127.0.0.1", family: 6 }])).err).toBeInstanceOf(WebhookTargetBlockedError);
    expect((await runLookup([{ address: "fd00::1", family: 6 }])).err).toBeInstanceOf(WebhookTargetBlockedError);
  });

  it("um único endereço interno entre vários derruba tudo (nunca escolhe o público)", async () => {
    const r = await runLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    expect(r.err).toBeInstanceOf(WebhookTargetBlockedError);
  });

  it("respeita o filtro de família pedido pelo socket", async () => {
    const r = await runLookup(
      [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:2800:220:1::1", family: 6 },
      ],
      { family: 6 }
    );
    expect(r.address).toBe("2606:2800:220:1::1");
    expect(r.family).toBe(6);
  });

  it("devolve ENOTFOUND quando não há endereço da família pedida", async () => {
    const r = await runLookup([{ address: "93.184.216.34", family: 4 }], { family: 6 });
    expect((r.err as NodeJS.ErrnoException).code).toBe("ENOTFOUND");
  });

  it("repassa o erro de DNS", async () => {
    const r = await runLookup(Object.assign(new Error("falhou"), { code: "ESERVFAIL" }));
    expect((r.err as NodeJS.ErrnoException).code).toBe("ESERVFAIL");
  });
});

describe("postToWebhook — recusas antes de abrir qualquer conexão", () => {
  it.each([
    "http://hooks.exemplo.com/x",
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost:3000/x",
    "https://[::1]/x",
    "https://usuario:senha@exemplo.com/x",
    "file:///etc/passwd",
  ])("recusa %s", async (url) => {
    await expect(postToWebhook(url, {}, "{}")).rejects.toBeInstanceOf(WebhookTargetBlockedError);
  });
});
