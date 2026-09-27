import { describe, expect, it } from "vitest";
import { redeemFailureMessage, redeemFailureStatus, type RedeemFailureReason } from "./messages";

const ALL: RedeemFailureReason[] = [
  "UNAVAILABLE",
  "NOT_FOUND",
  "WRONG_PIN",
  "TOO_MANY_ATTEMPTS",
  "ALREADY_REDEEMED",
  "EXPIRED",
  "NOT_YET_AVAILABLE",
  "VOIDED",
];

describe("recusas do resgate", () => {
  it.each(ALL)("%s tem mensagem e código HTTP", (reason) => {
    expect(redeemFailureMessage(reason).length).toBeGreaterThan(5);
    expect(redeemFailureStatus(reason)).toBeGreaterThanOrEqual(400);
  });

  it("os códigos HTTP dizem o que aconteceu", () => {
    expect(redeemFailureStatus("WRONG_PIN")).toBe(401);
    expect(redeemFailureStatus("NOT_FOUND")).toBe(404);
    expect(redeemFailureStatus("TOO_MANY_ATTEMPTS")).toBe(429);
    expect(redeemFailureStatus("ALREADY_REDEEMED")).toBe(409);
    expect(redeemFailureStatus("UNAVAILABLE")).toBe(503);
  });

  it("nenhuma mensagem promete avaliação ou fala em nota", () => {
    for (const reason of ALL) expect(redeemFailureMessage(reason)).not.toMatch(/avali|google|estrela|nota/i);
  });
});
