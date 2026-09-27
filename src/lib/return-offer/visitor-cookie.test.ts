import { describe, expect, it } from "vitest";
import { newVisitorId, parseVisitorId } from "./visitor-cookie";

describe("cookie do visitante", () => {
  it("um identificador novo é aceito pelo validador e nunca se repete", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newVisitorId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(parseVisitorId(id)).toBe(id);
  });

  it.each([undefined, null, "", "curto", "tem espaço tem espaço", "<script>alert(1)</script>", "a".repeat(65), "ok;path=/;evil"])(
    "recusa %j",
    (value) => {
      expect(parseVisitorId(value as string | null | undefined)).toBeNull();
    }
  );
});
