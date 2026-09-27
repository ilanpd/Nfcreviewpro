import { describe, expect, it } from "vitest";
import { ownerAvailabilityMessage } from "./owner-copy";
import type { OfferUnavailableReason } from "./availability";

const ALL: OfferUnavailableReason[] = ["KILL_SWITCH", "NOT_IN_PILOT", "PLAN_NOT_ALLOWED", "PAUSED", "NO_PIN"];

describe("ownerAvailabilityMessage", () => {
  it.each(ALL)("%s tem uma mensagem para o dono", (reason) => {
    expect(ownerAvailabilityMessage(reason).length).toBeGreaterThan(10);
  });

  it("nunca fala como se fosse com o cliente (nunca cita brinde resgatado por 'você')", () => {
    for (const reason of ALL) expect(ownerAvailabilityMessage(reason)).not.toMatch(/resgate agora|seu brinde/i);
  });

  it("PAUSED tranquiliza sobre os brindes já emitidos", () => {
    expect(ownerAvailabilityMessage("PAUSED")).toMatch(/já emitidos/);
  });

  it("NO_PIN aponta a ação concreta (definir o PIN)", () => {
    expect(ownerAvailabilityMessage("NO_PIN")).toMatch(/PIN/);
  });
});
