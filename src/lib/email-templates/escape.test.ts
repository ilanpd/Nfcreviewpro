import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escapeHtml, safeHref } from "./escape";
import { contactNotificationEmailHtml } from "./contact";
import { newFeedbackEmailHtml } from "./feedback";
import { billingPastDueEmailHtml, subscriptionCanceledEmailHtml, subscriptionWelcomeEmailHtml } from "./billing";
import { personalLinkRecoveryEmailHtml } from "./meu-cartao";
import { returnReengagementEmailHtml } from "./reengagement";
import { returnActivatedEmailHtml } from "./return-offer";
import { confirmationEmailHtml, deliveredEmailHtml, shippedEmailHtml } from "./store-order";

/** Texto de um visitante mal-intencionado: tenta fechar o elemento/atributo e abrir um link, uma imagem e um script. */
const EVIL = `<a href="https://golpe.example/login">Verifique sua conta</a><img src=x onerror=alert(1)><script>alert(2)</script>"'><b onmouseover=x>`;

/** Nenhuma tag nem atributo vindos do texto malicioso podem existir no HTML final. */
function expectNoInjection(html: string) {
  expect(html).not.toMatch(/<a href="https:\/\/golpe/);
  expect(html).not.toMatch(/<img\b/);
  expect(html).not.toMatch(/<script\b/i);
  expect(html).not.toMatch(/<b onmouseover/);
  // "onerror=" como TEXTO escapado (ou dentro de um valor de atributo entre aspas) é inofensivo; o que não pode
  // existir é um atributo de evento solto numa tag de verdade. Tira os valores entre aspas e procura o que sobrar.
  const withoutQuotedValues = html.replace(/="[^"]*"/g, '=""');
  expect(withoutQuotedValues).not.toMatch(/<[^>]*\son(error|mouseover)=/);
  expect(html).not.toMatch(/href="https:\/\/golpe/);
  expect(html).toContain("&lt;a href=&quot;https://golpe.example/login&quot;&gt;"); // o texto continua visível, só inofensivo
}

describe("escapeHtml / safeHref", () => {
  it("escapa os 5 caracteres perigosos e aceita nulo", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
  it("não escapa duas vezes um texto comum", () => {
    expect(escapeHtml("Café & Cia")).toBe("Café &amp; Cia");
  });
  it("href só aceita http(s) e mailto", () => {
    expect(safeHref("https://app.exemplo.com.br/x?a=1&b=2")).toBe("https://app.exemplo.com.br/x?a=1&amp;b=2");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("  JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeHref("data:text/html;base64,AAAA")).toBe("#");
    expect(safeHref("")).toBe("#");
  });
  it("href malicioso não consegue fechar o atributo", () => {
    expect(safeHref(`https://x.example/"onmouseover="alert(1)`)).not.toContain(`"onmouseover`);
  });
});

describe("e-mails: texto de terceiros nunca vira HTML", () => {
  it("contato (formulário público): nome, e-mail e mensagem", () => {
    expectNoInjection(contactNotificationEmailHtml({ name: EVIL, email: `x@y.com"${EVIL}`, message: EVIL }));
  });
  it("mensagem privada de um cliente: texto e nome do cartão", () => {
    expectNoInjection(newFeedbackEmailHtml({ messagePreview: EVIL, cardName: EVIL, mensagensUrl: "https://app.exemplo.com.br/dashboard/mensagens" }));
  });
  it("loja: nome do cliente nos três e-mails, código de rastreio e transportadora", () => {
    const base = { customerName: EVIL, orderShort: EVIL, productLabel: EVIL, quantity: 1, amountTotalCents: 1000 };
    expectNoInjection(confirmationEmailHtml(base));
    expectNoInjection(shippedEmailHtml({ ...base, trackingCode: EVIL, carrier: EVIL }));
    expectNoInjection(deliveredEmailHtml(base));
  });
  it("assinatura: nome da empresa e do plano", () => {
    expectNoInjection(subscriptionWelcomeEmailHtml({ companyName: EVIL, planLabel: EVIL, dashboardUrl: "https://app.exemplo.com.br/dashboard" }));
    expectNoInjection(billingPastDueEmailHtml({ companyName: EVIL, settingsUrl: "https://app.exemplo.com.br/s" }));
    expectNoInjection(subscriptionCanceledEmailHtml({ companyName: EVIL, dashboardUrl: "https://app.exemplo.com.br/s" }));
  });
  it("Retorno e reengajamento: nome da empresa e título do brinde", () => {
    expectNoInjection(returnActivatedEmailHtml({ companyName: EVIL, offerTitle: EVIL, dashboardUrl: "https://app.exemplo.com.br/r" }));
    expectNoInjection(returnReengagementEmailHtml({ companyName: EVIL, milestone: "D7", retornoUrl: "https://app.exemplo.com.br/r" }));
    expectNoInjection(returnReengagementEmailHtml({ companyName: EVIL, milestone: "D30", retornoUrl: "https://app.exemplo.com.br/r" }));
  });
  it("link pessoal: nome do cartão", () => {
    expectNoInjection(personalLinkRecoveryEmailHtml([{ name: EVIL, url: "https://app.exemplo.com.br/meu-cartao/abc" }]));
  });
  it("o botão nunca emite um href que não seja http(s)", () => {
    const html = billingPastDueEmailHtml({ companyName: "Loja", settingsUrl: "javascript:alert(1)" });
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });
  it("texto comum continua legível (sem escape duplo)", () => {
    const html = contactNotificationEmailHtml({ name: "Ana & Cia", email: "ana@exemplo.com", message: "Olá, tudo bem?" });
    expect(html).toContain("Ana &amp; Cia escreveu pelo site");
    expect(html).toContain("Olá, tudo bem?");
    expect(html).toContain('href="mailto:ana@exemplo.com"');
  });
});
