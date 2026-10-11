import { describe, expect, it } from "vitest";
import { createContactMessageSchema } from "@/lib/validations/contact";
import { createFeedbackSchema } from "@/lib/validations/feedback";
import { createRatingSchema, createVisitSchema } from "@/lib/validations/rating";
import { customerDocumentSchema, customerPhoneSchema, directSaleSchema } from "@/lib/validations/store-order";
import { createCardSchema } from "@/lib/validations/card";
import { httpUrlSchema } from "@/lib/validations/http-url";

/**
 * Entradas hostis nos formulários PÚBLICOS (qualquer pessoa na internet pode mandar): tamanho, tipo, formato,
 * esquema de URL e campos extras. Cada recusa aqui acontece ANTES de qualquer consulta ao banco.
 */
const SQLI = [`'; DROP TABLE "NFCCard"; --`, `" OR 1=1 --`, `' UNION SELECT "id" FROM "Company" --`, `%' OR '1'='1`];
const NOT_TEXT: unknown[] = [null, undefined, 42, true, ["a"], { $ne: "" }, { toString: "x" }];

describe("formulário de contato (anônimo)", () => {
  const valid = { name: "Ana Souza", email: "ana@exemplo.com.br", message: "Quero saber mais sobre o cartão." };

  it("aceita um envio normal", () => {
    expect(createContactMessageSchema.safeParse(valid).success).toBe(true);
  });
  it("recusa texto acima do limite (nome 80, e-mail 160, mensagem 2000)", () => {
    expect(createContactMessageSchema.safeParse({ ...valid, name: "N".repeat(81) }).success).toBe(false);
    expect(createContactMessageSchema.safeParse({ ...valid, email: `${"a".repeat(160)}@x.com` }).success).toBe(false);
    expect(createContactMessageSchema.safeParse({ ...valid, message: "M".repeat(2001) }).success).toBe(false);
    expect(createContactMessageSchema.safeParse({ ...valid, message: "M".repeat(900_000) }).success).toBe(false); // quase 1 MB
  });
  it.each(NOT_TEXT)("recusa campo que não é texto: %j", (bad) => {
    expect(createContactMessageSchema.safeParse({ ...valid, message: bad }).success).toBe(false);
    expect(createContactMessageSchema.safeParse({ ...valid, name: bad }).success).toBe(false);
    expect(createContactMessageSchema.safeParse({ ...valid, email: bad }).success).toBe(false);
  });
  it("campos extras são DESCARTADOS (nada de definir id, respondedAt ou companyId pelo corpo)", () => {
    const parsed = createContactMessageSchema.parse({ ...valid, id: "x", respondedAt: new Date(), companyId: "alheia", isAdmin: true });
    expect(Object.keys(parsed).sort()).toEqual(["email", "message", "name"]);
  });
  it.each(SQLI)("injeção de SQL como texto vira só texto, sem erro nem interpretação: %s", (payload) => {
    const parsed = createContactMessageSchema.parse({ ...valid, message: `${payload} (mensagem)` });
    expect(parsed.message).toBe(`${payload} (mensagem)`);
  });
});

describe("mensagem de cliente no cartão (anônimo)", () => {
  const cuid = "cmv4bqhk20000igfdg41zk5za";
  it("exige exatamente UMA origem", () => {
    expect(createFeedbackSchema.safeParse({ visitId: cuid, message: "Demorou muito" }).success).toBe(true);
    expect(createFeedbackSchema.safeParse({ message: "Demorou muito" }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ visitId: cuid, ratingEventId: cuid, message: "Demorou muito" }).success).toBe(false);
  });
  it("recusa mensagem de 1001 caracteres e id que não é cuid (inclui injeção de SQL no id)", () => {
    expect(createFeedbackSchema.safeParse({ visitId: cuid, message: "m".repeat(1001) }).success).toBe(false);
    for (const payload of SQLI) {
      expect(createFeedbackSchema.safeParse({ visitId: payload, message: "Demorou muito" }).success).toBe(false);
      expect(createFeedbackSchema.safeParse({ ratingEventId: payload, message: "Demorou muito" }).success).toBe(false);
    }
  });
  it("código do cartão: 4 a 32 caracteres", () => {
    expect(createFeedbackSchema.safeParse({ cardCode: "abc", message: "Demorou muito" }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ cardCode: "a".repeat(33), message: "Demorou muito" }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ cardCode: "abcd2345", message: "Demorou muito" }).success).toBe(true);
  });
});

describe("visita e nota (anônimo)", () => {
  it("nota só de 1 a 5, inteira, como número", () => {
    for (const stars of [0, 6, -1, 1.5, NaN, Infinity, "5", null]) {
      expect(createRatingSchema.safeParse({ visitId: "cmv4bqhk20000igfdg41zk5za", stars }).success, String(stars)).toBe(false);
    }
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(createRatingSchema.safeParse({ visitId: "cmv4bqhk20000igfdg41zk5za", stars }).success).toBe(true);
    }
  });
  it("visitId só cuid; código de visita até 32", () => {
    for (const payload of SQLI) expect(createRatingSchema.safeParse({ visitId: payload, stars: 5 }).success).toBe(false);
    expect(createVisitSchema.safeParse({ code: "c".repeat(33) }).success).toBe(false);
    expect(createVisitSchema.safeParse({ code: "" }).success).toBe(false);
  });
});

describe("compra na loja (anônimo)", () => {
  const sale = {
    productId: "single",
    destinationUrl: "https://g.page/r/exemplo",
    customerName: "Ana Souza",
    customerEmail: "ana@exemplo.com.br",
    customerDocument: "529.982.247-25", // CPF de teste válido
    customerPhone: "(11) 91234-5678",
  };
  it("aceita uma compra normal", () => {
    expect(directSaleSchema.safeParse(sale).success).toBe(true);
  });
  it("recusa destino com esquema executável (javascript:, data:, file:, vbscript:) e URL de 2001 caracteres", () => {
    for (const destinationUrl of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "vbscript:msgbox(1)", "//evil.example/x", `https://x.example/${"a".repeat(2000)}`]) {
      expect(directSaleSchema.safeParse({ ...sale, destinationUrl }).success, destinationUrl.slice(0, 40)).toBe(false);
    }
    expect(httpUrlSchema().safeParse("http://exemplo.com.br/x").success).toBe(true);
  });
  it("recusa nome gigante, e-mail gigante e documento/telefone inválidos", () => {
    expect(directSaleSchema.safeParse({ ...sale, customerName: "N".repeat(121) }).success).toBe(false);
    expect(directSaleSchema.safeParse({ ...sale, customerEmail: `${"a".repeat(250)}@x.com` }).success).toBe(false);
    expect(customerDocumentSchema.safeParse("111.111.111-11").success).toBe(false);
    expect(customerDocumentSchema.safeParse("12345").success).toBe(false);
    expect(customerPhoneSchema.safeParse("123").success).toBe(false);
    for (const payload of SQLI) {
      expect(customerDocumentSchema.safeParse(payload).success).toBe(false);
      expect(customerPhoneSchema.safeParse(payload).success).toBe(false);
    }
  });
});

describe("dados do painel (logado)", () => {
  it("cartão: nome com limite, campos extras descartados (não dá para definir companyId pelo corpo)", () => {
    const parsed = createCardSchema.safeParse({ name: "Mesa 1", tags: [], companyId: "alheia", uniqueCode: "forjado" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(Object.keys(parsed.data)).not.toContain("companyId");
    if (parsed.success) expect(Object.keys(parsed.data)).not.toContain("uniqueCode");
    expect(createCardSchema.safeParse({ name: "N".repeat(500), tags: [] }).success).toBe(false);
  });
});
