import { describe, expect, it } from "vitest";
import { dueReengagementMilestone, type ReengagementInput } from "./reengagement";

const NOW = new Date("2026-09-27T12:00:00Z");

function base(overrides: Partial<ReengagementInput> = {}): ReengagementInput {
  return {
    createdAt: NOW,
    returnOfferActive: false,
    canWrite: true,
    reengagementD7EmailSentAt: null,
    reengagementD30EmailSentAt: null,
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("dueReengagementMilestone", () => {
  it("nunca cobra quem já ativou o Retorno", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(10), returnOfferActive: true }), NOW)).toBeNull();
  });

  it("nunca cobra quem não tem acesso de escrita agora", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(10), canWrite: false }), NOW)).toBeNull();
  });

  it("nada antes do dia 7", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(6) }), NOW)).toBeNull();
  });

  it("D7 exatamente no dia 7, se ainda não foi enviado", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(7) }), NOW)).toBe("D7");
  });

  it("nada entre D7 (já enviado) e D30", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(15), reengagementD7EmailSentAt: daysAgo(8) }), NOW)).toBeNull();
  });

  it("D30 no dia 30, mesmo se D7 nunca foi enviado (catch-up)", () => {
    expect(dueReengagementMilestone(base({ createdAt: daysAgo(30) }), NOW)).toBe("D30");
  });

  it("depois do D30 enviado, nunca mais manda nada — nem o D7 que nunca saiu", () => {
    expect(
      dueReengagementMilestone(base({ createdAt: daysAgo(40), reengagementD30EmailSentAt: daysAgo(10) }), NOW)
    ).toBeNull();
  });

  it("D30 enviado bloqueia também um D7 que ficaria pendente por acaso", () => {
    expect(
      dueReengagementMilestone(
        base({ createdAt: daysAgo(35), reengagementD7EmailSentAt: null, reengagementD30EmailSentAt: daysAgo(5) }),
        NOW
      )
    ).toBeNull();
  });
});
