import { describe, expect, it } from "vitest";
import { maskPii, scrubExtra, scrubSentryEvent } from "./scrub";

describe("maskPii", () => {
  it("mascara e-mails em qualquer parte do texto", () => {
    expect(maskPii("Resend recusou o envio para maria.silva+loja@exemplo.com.br agora")).toBe("Resend recusou o envio para [e-mail] agora");
  });

  it("mascara CPF e CNPJ, com e sem pontuação", () => {
    expect(maskPii("cliente 123.456.789-09")).toBe("cliente [documento]");
    expect(maskPii("cliente 12345678909")).toBe("cliente [documento]");
    expect(maskPii("empresa 12.345.678/0001-95")).toBe("empresa [documento]");
    expect(maskPii("empresa 12345678000195")).toBe("empresa [documento]");
  });

  it("mascara telefone brasileiro em formatos comuns", () => {
    expect(maskPii("ligar (11) 98765-4321")).toBe("ligar [telefone]");
    // 11 dígitos colados são ambíguos (CPF ou celular): o rótulo pode ser qualquer um, o que vale é mascarar
    expect(maskPii("ligar 11987654321")).toMatch(/^ligar \[(telefone|documento)\]$/);
    expect(maskPii("ligar +55 11 98765-4321")).toBe("ligar [telefone]");
  });

  it("não mexe em ids e números comuns", () => {
    const texto = "pedido cmuum2ivi002ytsfdi4m5aisp quantidade 20 total 78000 centavos código L001-07";
    expect(maskPii(texto)).toBe(texto);
  });
});

describe("scrubExtra", () => {
  it("remove as chaves sensíveis e mantém os ids", () => {
    const r = scrubExtra({ error: "falhou", to: "a@b.com", subject: "Seu pedido de Maria", sessionId: "cs_123", companyId: "c1" });
    expect(r).toEqual({ error: "falhou", sessionId: "cs_123", companyId: "c1" });
  });

  it("limpa em qualquer profundidade e dentro de listas", () => {
    const r = scrubExtra({ pedido: { id: "o1", customerName: "Maria", customerEmail: "m@x.com", itens: [{ nome: "Cartão", cpf: "12345678909", ok: 1 }] } });
    expect(r).toEqual({ pedido: { id: "o1", itens: [{ ok: 1 }] } });
  });

  it("mascara e-mail escondido dentro de um texto de erro", () => {
    expect(scrubExtra({ error: "Error: invalid recipient joao@x.com" })).toEqual({ error: "Error: invalid recipient [e-mail]" });
  });

  it("não quebra com ciclos muito profundos", () => {
    let deep: Record<string, unknown> = { fim: 1 };
    for (let i = 0; i < 20; i++) deep = { n: deep };
    expect(() => scrubExtra(deep)).not.toThrow();
  });
});

describe("scrubSentryEvent", () => {
  it("limpa mensagem, exceção, extras, breadcrumbs, requisição e usuário", () => {
    const event = scrubSentryEvent({
      message: "falha para ana@x.com",
      exception: { values: [{ value: "Invalid input for 123.456.789-09" }] },
      extra: { to: "ana@x.com", sessionId: "cs_1" },
      breadcrumbs: [{ message: '{"to":"ana@x.com","level":"error"}', data: { email: "ana@x.com", status: 500 } }],
      request: {
        data: { nome: "Ana" },
        cookies: { sessao: "abc" },
        query_string: "email=ana@x.com",
        headers: { cookie: "a=1", authorization: "Bearer x", "user-agent": "Mozilla" },
      },
      user: { email: "ana@x.com" },
    });
    expect(event.message).toBe("falha para [e-mail]");
    expect(event.exception?.values?.[0].value).toBe("Invalid input for [documento]");
    expect(event.extra).toEqual({ sessionId: "cs_1" });
    expect(event.breadcrumbs?.[0].message).toBe('{"to":"[e-mail]","level":"error"}');
    expect(event.breadcrumbs?.[0].data).toEqual({ status: 500 });
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.headers).toEqual({ "user-agent": "Mozilla" });
    expect(event.user).toBeUndefined();
  });

  it("aceita um evento mínimo", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });
});
