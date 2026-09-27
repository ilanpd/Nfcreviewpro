import { describe, expect, it } from "vitest";
import { classifyCardBaseUrl, isCardUrlBlocked, joinCardUrl, resolveCardBaseInput } from "./classify";

describe("classifyCardBaseUrl", () => {
  it("aceita https em domínio próprio como definitivo e normaliza a origem", () => {
    const status = classifyCardBaseUrl("https://pulse.com.br/");
    expect(status.kind).toBe("final");
    expect(status.origin).toBe("https://pulse.com.br");
    expect(status.host).toBe("pulse.com.br");
  });

  it("descarta caminho e query: só a origem entra no chip", () => {
    expect(classifyCardBaseUrl("https://pulse.com.br/app?x=1").origin).toBe("https://pulse.com.br");
  });

  it.each(["https://nfc-os-production.vercel.app", "https://meu.netlify.app", "https://x.pages.dev", "https://abc.ngrok-free.app"])(
    "trata %s como provisório",
    (url) => {
      expect(classifyCardBaseUrl(url).kind).toBe("provisional");
    }
  );

  it("trata http fora de localhost como provisório", () => {
    expect(classifyCardBaseUrl("http://pulse.com.br").kind).toBe("provisional");
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "http://app.localhost:3000", "http://pulse.test"])(
    "trata %s como local",
    (url) => {
      expect(classifyCardBaseUrl(url).kind).toBe("local");
    }
  );

  it.each(["", "não é url", "ftp://pulse.com.br", "javascript:alert(1)"])("recusa %j como inválido", (value) => {
    const status = classifyCardBaseUrl(value);
    expect(status.kind).toBe("invalid");
    expect(status.origin).toBe("");
  });

  it("só o sufixo real do host conta como provisório, não um texto parecido no meio dele", () => {
    expect(classifyCardBaseUrl("https://pulse.vercel.app.evil.com").kind).toBe("final");
    expect(classifyCardBaseUrl("https://pulse-vercel.app").kind).toBe("final");
  });
});

describe("resolveCardBaseInput", () => {
  it("prioriza o endereço do cartão", () => {
    expect(resolveCardBaseInput("https://cartao.com", "https://app.com")).toBe("https://cartao.com");
  });
  it("cai na URL do app quando o do cartão está ausente ou em branco", () => {
    expect(resolveCardBaseInput(undefined, "https://app.com")).toBe("https://app.com");
    expect(resolveCardBaseInput("   ", "https://app.com")).toBe("https://app.com");
  });
  it("cai no servidor local quando não há nada", () => {
    expect(resolveCardBaseInput(undefined, undefined)).toBe("http://localhost:3000");
  });
});

describe("isCardUrlBlocked", () => {
  it("nunca bloqueia se o ambiente não exige endereço definitivo", () => {
    for (const kind of ["final", "provisional", "local", "invalid"] as const) {
      expect(isCardUrlBlocked(kind, false)).toBe(false);
    }
  });
  it("exigindo definitivo, só o definitivo passa", () => {
    expect(isCardUrlBlocked("final", true)).toBe(false);
    for (const kind of ["provisional", "local", "invalid"] as const) {
      expect(isCardUrlBlocked(kind, true)).toBe(true);
    }
  });
});

describe("joinCardUrl", () => {
  it("monta origem + /r/ + código", () => {
    expect(joinCardUrl("https://pulse.com.br", "k7x4qm2a")).toBe("https://pulse.com.br/r/k7x4qm2a");
  });
});
