import { describe, expect, it } from "vitest";
import { createCampaignSchema, updateCampaignSchema, urlRedirectConfigSchema } from "./campaign";

/**
 * Auditoria de 28/09/2026 (P0): o destino de uma campanha URL_REDIRECT/
 * INSTAGRAM/GOOGLE_REVIEWS/TIKTOK/DIGITAL_MENU/LANDING_PAGE é exatamente o
 * que `redirect()` usa em `/r/[code]/page.tsx` — o caminho crítico que
 * QUALQUER desconhecido percorre ao tocar o cartão físico. `z.string().url()`
 * aceitava `javascript:`/`data:`/`file:`; agora só http(s) passa, aqui e em
 * `createCampaignSchema`/`updateCampaignSchema` (que chamam este mesmo
 * schema via `configSchemaForType`).
 */
const DANGEROUS = ["javascript:alert(document.cookie)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "vbscript:msgbox(1)"];

const baseCampaign = {
  name: "Link do Instagram",
  type: "INSTAGRAM" as const,
  config: { url: "https://instagram.com/bella" },
};

describe("urlRedirectConfigSchema", () => {
  it.each(DANGEROUS)("recusa %s como destino", (url) => {
    expect(urlRedirectConfigSchema.safeParse({ url }).success).toBe(false);
  });

  it("aceita http(s)", () => {
    expect(urlRedirectConfigSchema.safeParse({ url: "https://instagram.com/bella" }).success).toBe(true);
  });
});

describe("createCampaignSchema — a config é validada contra o tipo escolhido", () => {
  it.each(DANGEROUS)("recusa criar uma campanha URL_REDIRECT com destino %s", (url) => {
    const result = createCampaignSchema.safeParse({ ...baseCampaign, config: { url } });
    expect(result.success).toBe(false);
  });

  it("aceita um destino http(s) de verdade", () => {
    expect(createCampaignSchema.safeParse(baseCampaign).success).toBe(true);
  });
});

describe("updateCampaignSchema — mesma trava ao editar", () => {
  it("recusa trocar o destino de uma campanha existente para javascript:", () => {
    const result = updateCampaignSchema.safeParse({ type: "INSTAGRAM", config: { url: "javascript:alert(1)" } });
    expect(result.success).toBe(false);
  });

  it("edição parcial sem mexer no destino (ex.: só o nome) nunca precisa revalidar a config", () => {
    expect(updateCampaignSchema.safeParse({ name: "Novo nome" }).success).toBe(true);
  });
});
