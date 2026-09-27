import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPin, verifyPin } from "./pin-hash";

afterEach(() => vi.unstubAllEnvs());

describe("hashPin / verifyPin", () => {
  it("o PIN certo confere e o errado não", () => {
    const stored = hashPin("4821");
    expect(verifyPin("4821", stored)).toBe(true);
    expect(verifyPin("4822", stored)).toBe(false);
    expect(verifyPin("", stored)).toBe(false);
  });

  it("nunca guarda o PIN em claro e usa sal: o mesmo PIN gera hashes diferentes", () => {
    const a = hashPin("4821");
    const b = hashPin("4821");
    expect(a).not.toContain("4821");
    expect(a).not.toBe(b);
    expect(verifyPin("4821", a)).toBe(true);
    expect(verifyPin("4821", b)).toBe(true);
  });

  it("hash ausente ou malformado nunca confere", () => {
    expect(verifyPin("4821", null)).toBe(false);
    expect(verifyPin("4821", "")).toBe(false);
    expect(verifyPin("4821", "s1$so-um-pedaco")).toBe(false);
    expect(verifyPin("4821", "s9$abc$def")).toBe(false);
  });

  it("o segredo do servidor faz parte do hash: com outro segredo o mesmo hash não confere", () => {
    vi.stubEnv("RETURN_PIN_SECRET", "segredo-a");
    const stored = hashPin("4821");
    expect(verifyPin("4821", stored)).toBe(true);
    vi.stubEnv("RETURN_PIN_SECRET", "segredo-b");
    expect(verifyPin("4821", stored)).toBe(false);
  });

  it("em produção, sem o segredo, recusa em vez de usar um valor padrão", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RETURN_PIN_SECRET", "");
    expect(() => hashPin("4821")).toThrow(/RETURN_PIN_SECRET/);
  });
});
