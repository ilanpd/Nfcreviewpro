import { describe, expect, it } from "vitest";
import {
  PUBLIC_STATES,
  demoTouch,
  screenCopy,
  screenForLookedUpVoucher,
  screenForTouch,
  screenHasCode,
  shareMessage,
  showsCodeEntry,
  type TouchScreen,
} from "./public-screen";
import type { PublicVoucherView, ReturnTouchView } from "./view";

const SP = "America/Sao_Paulo";
const NOW = new Date("2026-09-25T17:32:00Z");

function voucher(patch: Partial<PublicVoucherView> = {}): PublicVoucherView {
  return {
    code: "K7X-4QM",
    title: "Hidratação grátis",
    phase: "NOT_YET",
    availableAt: "2026-09-26T03:00:00.000Z",
    expiresAt: "2026-10-10T03:00:00.000Z",
    availableLabel: "26/09",
    lastValidLabel: "09/10",
    ...patch,
  };
}

describe("screenForTouch", () => {
  it("1: primeiro toque mostra o brinde novo", () => {
    const screen = screenForTouch({ state: "ISSUED", voucher: voucher() });
    expect(screen.kind).toBe("VOUCHER_NEW");
    expect(screenCopy(screen)).toEqual({
      eyebrow: "Seu brinde da próxima visita",
      title: "Hidratação grátis",
      detail: "Vale de amanhã até 09/10",
    });
  });

  it("2: brinde que ainda não liberou mostra \"libera amanhã\"", () => {
    const screen = screenForTouch({ state: "EXISTING", voucher: voucher({ phase: "NOT_YET" }) });
    expect(screen.kind).toBe("VOUCHER_WAITING");
    expect(screenCopy(screen)!.detail).toBe("Libera amanhã, dia 26/09. Vale até 09/10");
  });

  it("3: brinde liberado mostra \"Brinde liberado\" e a validade", () => {
    const screen = screenForTouch({ state: "EXISTING", voucher: voucher({ phase: "AVAILABLE" }) });
    expect(screen.kind).toBe("VOUCHER_READY");
    expect(screenCopy(screen)).toMatchObject({ eyebrow: "Brinde liberado", detail: "Vence em 09/10" });
  });

  it("4 e 10: sem oferta ou falha, só os botões (nunca uma oferta vazia)", () => {
    expect(screenForTouch(null).kind).toBe("NO_OFFER");
    expect(screenForTouch({ state: "CAP_REACHED" }).kind).toBe("NO_OFFER");
    expect(screenCopy({ kind: "NO_OFFER" })).toBeNull();
  });

  it("5: brinde anterior venceu, com a data do próximo", () => {
    const screen = screenForTouch({ state: "COOLDOWN", nextEligibleLabel: "27/10", lastStatus: "EXPIRED" });
    expect(screen.kind).toBe("EXPIRED_NOTICE");
    expect(screenCopy(screen)).toMatchObject({ title: "Seu brinde anterior venceu", detail: "Um novo fica disponível a partir de 27/10" });
  });

  it("6: já resgatado", () => {
    const screen = screenForTouch({ state: "COOLDOWN", nextEligibleLabel: "27/10", lastStatus: "REDEEMED" });
    expect(screen.kind).toBe("USED_NOTICE");
    expect(screenCopy(screen)!.title).toBe("Este brinde já foi usado");
  });

  it("um brinde ainda emitido dentro da carência (venceu sem ser marcado) conta como vencido", () => {
    expect(screenForTouch({ state: "COOLDOWN", nextEligibleLabel: "27/10", lastStatus: "ISSUED" }).kind).toBe("EXPIRED_NOTICE");
  });
});

describe("screenForLookedUpVoucher (estados 7 e 8)", () => {
  it.each([
    ["NOT_YET", "VOUCHER_WAITING"],
    ["AVAILABLE", "VOUCHER_READY"],
    ["REDEEMED", "CODE_USED"],
    ["EXPIRED", "CODE_EXPIRED"],
    ["VOIDED", "CODE_VOIDED"],
  ] as const)("fase %s vira %s", (phase, kind) => {
    expect(screenForLookedUpVoucher(voucher({ phase })).kind).toBe(kind);
  });

  it("os avisos de código usado, vencido e cancelado têm texto próprio", () => {
    expect(screenCopy(screenForLookedUpVoucher(voucher({ phase: "REDEEMED" })))!.title).toBe("Este brinde já foi usado");
    expect(screenCopy(screenForLookedUpVoucher(voucher({ phase: "EXPIRED" })))).toMatchObject({ title: "Este brinde venceu", detail: "Valia até 09/10" });
    expect(screenCopy(screenForLookedUpVoucher(voucher({ phase: "VOIDED" })))!.title).toBe("Este brinde foi cancelado");
  });
});

describe("screenHasCode / showsCodeEntry", () => {
  const screens: TouchScreen[] = [
    { kind: "VOUCHER_NEW", voucher: voucher() },
    { kind: "VOUCHER_WAITING", voucher: voucher() },
    { kind: "VOUCHER_READY", voucher: voucher() },
    { kind: "USED_NOTICE", nextEligibleLabel: "27/10" },
    { kind: "EXPIRED_NOTICE", nextEligibleLabel: "27/10" },
    { kind: "NO_OFFER" },
  ];

  it("só as três telas de brinde têm código", () => {
    expect(screens.filter(screenHasCode).map((s) => s.kind)).toEqual(["VOUCHER_NEW", "VOUCHER_WAITING", "VOUCHER_READY"]);
  });

  it("o convite para digitar um código aparece onde o aparelho não tem código para mostrar", () => {
    expect(screens.filter(showsCodeEntry).map((s) => s.kind)).toEqual(["USED_NOTICE", "EXPIRED_NOTICE", "NO_OFFER"]);
  });
});

describe("textos: nenhum cita avaliação", () => {
  it("o brinde e o compartilhamento não falam de avaliar, Google ou estrelas", () => {
    const touches: ReturnTouchView[] = [
      { state: "ISSUED", voucher: voucher() },
      { state: "EXISTING", voucher: voucher({ phase: "AVAILABLE" }) },
      { state: "COOLDOWN", nextEligibleLabel: "27/10", lastStatus: "REDEEMED" },
      { state: "COOLDOWN", nextEligibleLabel: "27/10", lastStatus: "EXPIRED" },
    ];
    const texts = touches.flatMap((t) => {
      const copy = screenCopy(screenForTouch(t))!;
      return [copy.eyebrow, copy.title, copy.detail];
    });
    texts.push(shareMessage(voucher(), "Bella Vista"));
    for (const text of texts) expect(text).not.toMatch(/avali|google|estrela|review/i);
  });

  it("o texto de compartilhar leva o nome do negócio, o brinde, o código e a validade", () => {
    expect(shareMessage(voucher(), "Bella Vista")).toBe("Meu brinde em Bella Vista: Hidratação grátis. Código K7X-4QM, vale até 09/10.");
  });
});

describe("catálogo dos 16 estados (J4)", () => {
  it("tem exatamente os 16, numerados de 1 a 16 e sem repetição", () => {
    expect(PUBLIC_STATES.map((s) => s.n)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(new Set(PUBLIC_STATES.map((s) => s.id)).size).toBe(16);
  });

  it("todo estado diz onde e como é tratado", () => {
    for (const state of PUBLIC_STATES) {
      expect(["tela", "servidor", "ambiente"]).toContain(state.handledBy);
      expect(state.how.length).toBeGreaterThan(10);
      expect(state.label.length).toBeGreaterThan(3);
    }
  });

  it("os estados de servidor são 14, 15 e 16", () => {
    expect(PUBLIC_STATES.filter((s) => s.handledBy === "servidor").map((s) => s.n)).toEqual([14, 15, 16]);
  });
});

describe("demoTouch (modo de teste do dono)", () => {
  const input = { title: "Hidratação grátis", timeZone: SP, windowDays: 14, now: NOW };

  it("os estados de brinde usam a mesma janela real: vale de amanhã até 09/10", () => {
    const first = demoTouch("FIRST_TOUCH", input).touch!;
    expect(first).toMatchObject({ state: "ISSUED", voucher: { availableLabel: "26/09", lastValidLabel: "09/10", phase: "NOT_YET" } });
    expect(demoTouch("WAITING", input).touch).toMatchObject({ state: "EXISTING", voucher: { phase: "NOT_YET" } });
    expect(demoTouch("READY", input).touch).toMatchObject({ state: "EXISTING", voucher: { phase: "AVAILABLE", lastValidLabel: "09/10" } });
  });

  it("carência: usado e vencido, com a data do próximo", () => {
    expect(demoTouch("USED", input).touch).toMatchObject({ state: "COOLDOWN", lastStatus: "REDEEMED", nextEligibleLabel: "15/10" });
    expect(demoTouch("EXPIRED", input).touch).toMatchObject({ state: "COOLDOWN", lastStatus: "EXPIRED" });
  });

  it("sem brinde, pausado e erro devolvem nenhum brinde; erro marca a falha", () => {
    expect(demoTouch("COOLDOWN_QUIET", input).touch).toBeNull();
    expect(demoTouch("PAUSED", input).touch).toBeNull();
    expect(demoTouch("OFFLINE", input)).toEqual({ touch: null, forceOffline: true });
    expect(demoTouch("UNKNOWN", input).touch).toBeNull();
  });

  it("todo estado marcado como simulável produz uma tela", () => {
    for (const state of PUBLIC_STATES.filter((s) => s.demo)) {
      const { touch } = demoTouch(state.id, input);
      expect(() => screenForTouch(touch)).not.toThrow();
    }
  });
});
