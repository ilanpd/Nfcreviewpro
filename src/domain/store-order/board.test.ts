import { describe, expect, it } from "vitest";
import { deriveBoardColumn, isForwardAdjacent, COLUMN_ENTRY_STEP, BOARD_COLUMNS } from "./board";
import type { StoreOrderChecklistLike } from "./checklist";

function order(overrides: Partial<StoreOrderChecklistLike> = {}): StoreOrderChecklistLike {
  return {
    status: "PAID",
    provisionedAt: null,
    stockConfirmedAt: null,
    printedAt: null,
    nfcWrittenAt: null,
    qcPassedAt: null,
    packagedAt: null,
    shippedAt: null,
    deliveredAt: null,
    trackingCode: null,
    carrier: null,
    ...overrides,
  };
}

describe("deriveBoardColumn", () => {
  it("places a freshly paid order in PAGO", () => {
    expect(deriveBoardColumn(order())).toBe("PAGO");
  });

  it("moves forward one column per timestamp, always taking the latest", () => {
    expect(deriveBoardColumn(order({ stockConfirmedAt: new Date() }))).toBe("SEPARACAO");
    expect(deriveBoardColumn(order({ stockConfirmedAt: new Date(), printedAt: new Date() }))).toBe("IMPRESSAO");
    expect(
      deriveBoardColumn(order({ stockConfirmedAt: new Date(), printedAt: new Date(), nfcWrittenAt: new Date() }))
    ).toBe("PROGRAMACAO_NFC");
    expect(
      deriveBoardColumn(
        order({ stockConfirmedAt: new Date(), printedAt: new Date(), nfcWrittenAt: new Date(), qcPassedAt: new Date() })
      )
    ).toBe("QUALIDADE");
  });

  it("treats a packaged order as EMBALAGEM, distinct from a shipped one", () => {
    expect(deriveBoardColumn(order({ packagedAt: new Date() }))).toBe("EMBALAGEM");
    expect(deriveBoardColumn(order({ packagedAt: new Date(), shippedAt: new Date() }))).toBe("EXPEDICAO");
  });

  it("treats delivered as the terminal column regardless of earlier gaps", () => {
    // A real production run always fills every earlier timestamp, but the
    // derivation must not depend on that — deliveredAt alone should win.
    expect(deriveBoardColumn(order({ deliveredAt: new Date() }))).toBe("ENTREGUE");
  });
});

describe("isForwardAdjacent", () => {
  it("allows moving exactly one column forward", () => {
    expect(isForwardAdjacent("PAGO", "SEPARACAO")).toBe(true);
    expect(isForwardAdjacent("EMBALAGEM", "EXPEDICAO")).toBe(true);
  });

  it("rejects skipping a column", () => {
    expect(isForwardAdjacent("PAGO", "PROGRAMACAO_NFC")).toBe(false);
    expect(isForwardAdjacent("PAGO", "ENTREGUE")).toBe(false);
  });

  it("rejects moving backward", () => {
    expect(isForwardAdjacent("EXPEDICAO", "EMBALAGEM")).toBe(false);
  });
});

describe("COLUMN_ENTRY_STEP", () => {
  it("has no entry step for the first column — nothing precedes it", () => {
    expect(COLUMN_ENTRY_STEP.PAGO).toBeUndefined();
  });

  it("defines an entry step for every other column", () => {
    for (const column of BOARD_COLUMNS.slice(1)) {
      expect(COLUMN_ENTRY_STEP[column.key]).toBeDefined();
    }
  });
});
