import { describe, expect, it } from "vitest";
import { checkCronAuth } from "./cron-auth";

const SECRET = "segredo-de-teste-com-bastante-entropia-0123456789";

describe("checkCronAuth", () => {
  it("aceita só o Bearer exato", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe("ok");
  });
  it("recusa ausente, vazio, sem Bearer, com espaço a mais e segredo errado", () => {
    expect(checkCronAuth(null, SECRET)).toBe("unauthorized");
    expect(checkCronAuth("", SECRET)).toBe("unauthorized");
    expect(checkCronAuth(SECRET, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Bearer ${SECRET} `, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`bearer ${SECRET}`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth("Bearer outro", SECRET)).toBe("unauthorized");
  });
  it("sem CRON_SECRET configurado a rota fica DESLIGADA, mesmo para quem manda 'Bearer undefined'", () => {
    expect(checkCronAuth("Bearer undefined", undefined)).toBe("disabled");
    expect(checkCronAuth("Bearer ", "")).toBe("disabled");
    expect(checkCronAuth(null, undefined)).toBe("disabled");
  });
  it("não lança com cabeçalhos de tamanhos muito diferentes", () => {
    expect(() => checkCronAuth("B".repeat(100_000), SECRET)).not.toThrow();
    expect(checkCronAuth("B".repeat(100_000), SECRET)).toBe("unauthorized");
  });
});
