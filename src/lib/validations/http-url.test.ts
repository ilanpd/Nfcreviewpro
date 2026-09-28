import { describe, expect, it } from "vitest";
import { httpUrlSchema, isHttpUrl } from "./http-url";
import { activateCompanySchema, updateCompanySchema } from "./company";
import { directSaleSchema } from "./store-order";

/**
 * Auditoria C15: `z.string().url()` aceita `javascript:`, `data:` e `file:`.
 * O destino do cartão e o link do Google viram redirecionamento/`href` pra
 * desconhecidos que tocam o cartão — só http(s) entra.
 */
const DANGEROUS = ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "ftp://example.com/x", "vbscript:msgbox(1)"];

describe("isHttpUrl", () => {
  it.each(["https://g.page/r/bella/review", "http://example.com", "https://wa.me/5511987654321?text=oi"])("aceita %s", (url) => {
    expect(isHttpUrl(url)).toBe(true);
  });

  it.each([...DANGEROUS, "instagram.com/bella", "", "   ", "https://"])("recusa %j", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});

describe("httpUrlSchema", () => {
  it("apara espaços e devolve a URL limpa", () => {
    expect(httpUrlSchema().parse("  https://instagram.com/bella  ")).toBe("https://instagram.com/bella");
  });

  it("usa a mensagem passada", () => {
    const result = httpUrlSchema("Informe um link válido do Google").safeParse("nope");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Informe um link válido do Google");
  });

  it("recusa URL absurdamente longa", () => {
    expect(httpUrlSchema().safeParse(`https://example.com/${"a".repeat(2100)}`).success).toBe(false);
  });
});

describe("schemas que aceitam destino/link do usuário", () => {
  const sale = { productId: "single", customerName: "Bella Vista", customerEmail: "dono@example.com", customerDocument: "11122233396", customerPhone: "11987654321" };

  it.each(DANGEROUS)("venda direta recusa destino %s", (destinationUrl) => {
    expect(directSaleSchema.safeParse({ ...sale, destinationUrl }).success).toBe(false);
  });

  it("venda direta aceita destino https", () => {
    expect(directSaleSchema.safeParse({ ...sale, destinationUrl: "https://instagram.com/bella" }).success).toBe(true);
  });

  it.each(DANGEROUS)("ativação recusa googleReviewUrl %s", (googleReviewUrl) => {
    expect(activateCompanySchema.safeParse({ whatsapp: "11987654321", googleReviewUrl }).success).toBe(false);
  });

  it("ativação aceita o link do Google e usa a cor padrão", () => {
    const parsed = activateCompanySchema.parse({ whatsapp: "11987654321", googleReviewUrl: "https://g.page/r/bella/review" });
    expect(parsed.primaryColor).toBe("#0F172A");
  });

  it.each(DANGEROUS)("Configurações recusa googleReviewUrl %s", (googleReviewUrl) => {
    expect(updateCompanySchema.safeParse({ googleReviewUrl }).success).toBe(false);
  });

  it("Configurações continua aceitando limpar logo/favicon/fundo com string vazia", () => {
    expect(updateCompanySchema.safeParse({ logoUrl: "", faviconUrl: "", loginBackgroundUrl: "" }).success).toBe(true);
  });

  it.each(["logoUrl", "faviconUrl", "loginBackgroundUrl"] as const)("Configurações recusa %s com esquema perigoso", (field) => {
    expect(updateCompanySchema.safeParse({ [field]: "javascript:alert(1)" }).success).toBe(false);
  });
});
