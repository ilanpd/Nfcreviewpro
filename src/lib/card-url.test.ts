import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCardUrlReady, cardPublicUrl, cardQrPath, CardUrlNotReadyError, getCardUrlGuard, getCardUrlStatus } from "./card-url";

function setEnv(env: { card?: string; app?: string; require?: string }) {
  vi.stubEnv("NEXT_PUBLIC_CARD_BASE_URL", env.card ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", env.app ?? "");
  vi.stubEnv("CARD_URL_REQUIRE_FINAL", env.require ?? "");
}

afterEach(() => vi.unstubAllEnvs());

describe("cardPublicUrl", () => {
  it("usa o endereço do cartão quando definido, mesmo com outra URL de app", () => {
    setEnv({ card: "https://pulse.com.br", app: "https://app-provisorio.vercel.app" });
    expect(cardPublicUrl("k7x4qm2a")).toBe("https://pulse.com.br/r/k7x4qm2a");
  });

  it("sem endereço do cartão, cai na URL do app (compatível com o comportamento anterior)", () => {
    setEnv({ app: "https://app.pulse.com.br/" });
    expect(cardPublicUrl("k7x4qm2a")).toBe("https://app.pulse.com.br/r/k7x4qm2a");
  });

  it("sem nada definido, usa o servidor local", () => {
    setEnv({});
    expect(cardPublicUrl("k7x4qm2a")).toBe("http://localhost:3000/r/k7x4qm2a");
  });

  it("endereço inválido nunca produz um lixo no chip: cai no local e o status acusa o erro", () => {
    setEnv({ card: "isto não é url" });
    expect(cardPublicUrl("k7x4qm2a")).toBe("http://localhost:3000/r/k7x4qm2a");
    expect(getCardUrlStatus().kind).toBe("invalid");
  });
});

describe("cardQrPath", () => {
  it("monta o caminho com os parâmetros pedidos", () => {
    expect(cardQrPath("k7x4qm2a")).toBe("/api/qr/k7x4qm2a");
    expect(cardQrPath("k7x4qm2a", { size: 256 })).toBe("/api/qr/k7x4qm2a?size=256");
    expect(cardQrPath("k7x4qm2a", { size: 1024, format: "svg", download: true })).toBe(
      "/api/qr/k7x4qm2a?size=1024&format=svg&download=1"
    );
  });
});

describe("getCardUrlGuard / assertCardUrlReady", () => {
  it("sem exigência, endereço provisório passa (staging, desenvolvimento)", () => {
    setEnv({ card: "https://nfc-os-staging.vercel.app" });
    const guard = getCardUrlGuard();
    expect(guard.blocked).toBe(false);
    expect(guard.message).toBeNull();
    expect(() => assertCardUrlReady()).not.toThrow();
  });

  it("exigindo definitivo, endereço provisório bloqueia e explica", () => {
    setEnv({ card: "https://nfc-os-production.vercel.app", require: "1" });
    const guard = getCardUrlGuard();
    expect(guard.blocked).toBe(true);
    expect(guard.message).toMatch(/provisório/);
    expect(() => assertCardUrlReady()).toThrow(CardUrlNotReadyError);
  });

  it("exigindo definitivo, o endereço definitivo libera", () => {
    setEnv({ card: "https://pulse.com.br", require: "1" });
    expect(getCardUrlGuard().blocked).toBe(false);
    expect(() => assertCardUrlReady()).not.toThrow();
  });

  it("só o valor exato 1 liga a exigência", () => {
    setEnv({ card: "https://nfc-os-production.vercel.app", require: "true" });
    expect(getCardUrlGuard().blocked).toBe(false);
  });
});
