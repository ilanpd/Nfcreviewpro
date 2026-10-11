import { describe, expect, it } from "vitest";
import { displayPrimaryEmail, verifiedPrimaryEmail } from "./verified-email";

const user = (email: string | null | undefined, status?: string | null) => ({
  primaryEmailAddress: email === undefined ? null : { emailAddress: email, verification: status === undefined ? null : { status } },
});

describe("verifiedPrimaryEmail — o e-mail só vale como identidade se verificado", () => {
  it("devolve o e-mail quando está verificado", () => {
    expect(verifiedPrimaryEmail(user("dono@exemplo.com", "verified"))).toBe("dono@exemplo.com");
  });

  it("recusa o e-mail NÃO verificado (ataque: cadastrar-se com o e-mail de um admin)", () => {
    expect(verifiedPrimaryEmail(user("admin@exemplo.com", "unverified"))).toBeNull();
    expect(verifiedPrimaryEmail(user("admin@exemplo.com", "expired"))).toBeNull();
    expect(verifiedPrimaryEmail(user("admin@exemplo.com", "failed"))).toBeNull();
    expect(verifiedPrimaryEmail(user("admin@exemplo.com", "transferable"))).toBeNull();
  });

  it("recusa quando não há dado de verificação algum (fail-closed)", () => {
    expect(verifiedPrimaryEmail(user("admin@exemplo.com"))).toBeNull();
    expect(verifiedPrimaryEmail(user("admin@exemplo.com", null))).toBeNull();
  });

  it("recusa usuário ausente, sem e-mail ou com e-mail vazio", () => {
    expect(verifiedPrimaryEmail(null)).toBeNull();
    expect(verifiedPrimaryEmail(undefined)).toBeNull();
    expect(verifiedPrimaryEmail({})).toBeNull();
    expect(verifiedPrimaryEmail(user(null, "verified"))).toBeNull();
    expect(verifiedPrimaryEmail(user("   ", "verified"))).toBeNull();
  });

  it("não confunde 'verified' com texto parecido", () => {
    expect(verifiedPrimaryEmail(user("a@b.com", "Verified"))).toBeNull();
    expect(verifiedPrimaryEmail(user("a@b.com", "verified "))).toBeNull();
  });

  it("apara espaços do e-mail", () => {
    expect(verifiedPrimaryEmail(user("  a@b.com  ", "verified"))).toBe("a@b.com");
  });
});

describe("displayPrimaryEmail — só para exibir", () => {
  it("devolve o e-mail mesmo sem verificação, e null se não houver", () => {
    expect(displayPrimaryEmail(user("a@b.com", "unverified"))).toBe("a@b.com");
    expect(displayPrimaryEmail(null)).toBeNull();
    expect(displayPrimaryEmail({})).toBeNull();
  });
});
