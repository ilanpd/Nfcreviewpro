import { describe, expect, it } from "vitest";
import { findForbiddenRewardTerm, forbiddenRewardMessage } from "./compliance";

describe("findForbiddenRewardTerm", () => {
  it.each(["Hidratação grátis", "Café expresso na próxima visita", "10% de desconto no corte", "Sobremesa por conta da casa", "Lavagem simples grátis"])(
    "aceita %j",
    (text) => {
      expect(findForbiddenRewardTerm(text)).toBeNull();
    }
  );

  it.each([
    ["Ganhe um café ao avaliar", "avaliação"],
    ["Brinde por avaliação no Google", "avaliação"],
    ["Deixe um review e ganhe", "review"],
    ["Cupom se der 5 estrelas", "estrelas"],
    ["Ganhe 10% no Google Maps", "Google"],
    ["Elogie a gente e ganhe", "comentar/elogiar"],
    ["Comente e leve uma sobremesa", "comentar/elogiar"],
    ["Dê nota 10 e ganhe", "nota"],
  ])("recusa %j", (text, term) => {
    expect(findForbiddenRewardTerm(text)).toBe(term);
  });

  it("não confunde palavras que só contêm o radical (ex.: 'avaliar' está barrado, mas 'nota fiscal' passa)", () => {
    expect(findForbiddenRewardTerm("Nota fiscal grátis")).toBeNull();
    expect(findForbiddenRewardTerm("Estrelado de ovos por conta da casa")).toBeNull();
  });

  it("a mensagem de erro explica o motivo", () => {
    expect(forbiddenRewardMessage("Google")).toContain("proibido pelo Google");
  });
});
