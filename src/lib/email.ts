import "server-only";
import { Resend } from "resend";
import { log } from "@/lib/observability/logger";

/**
 * E-mail transacional (Auditoria do Fluxo de Vendas, 12/09/2026) — antes
 * desta fase, `lib/workers/processors.ts` documentava honestamente que
 * nenhum provedor de e-mail estava configurado; o cliente que pagasse um
 * pedido na loja nunca recebia confirmação, aviso de envio ou de entrega por
 * e-mail — só via isso se voltasse à aba de sucesso do checkout (perdida
 * depois de fechada) ou tivesse conta logada no dashboard.
 *
 * Mesmo padrão de degradação graciosa de `lib/stripe.ts`/`lib/redis.ts`: sem
 * `RESEND_API_KEY` configurada, todo envio vira um log estruturado
 * ("seria enviado: ...") em vez de lançar — o produto continua funcionando
 * por completo sem e-mail configurado, só sem essa camada de comunicação.
 * Configurar de verdade exige uma conta no Resend (ou outro provedor) e um
 * domínio de envio verificado — isso é uma decisão de negócio (qual domínio,
 * qual remetente), não algo que o código decide sozinho.
 */
declare global {
  var resendGlobal: Resend | undefined;
}

function createResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const resend = globalThis.resendGlobal ?? createResendClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.resendGlobal = resend ?? undefined;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "pedidos@nfcreviewpro.com.br";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Nunca lança — um e-mail que falha (provedor fora do ar, domínio não
 * verificado, chave inválida) não pode derrubar o fluxo de venda/produção
 * que o chamou. Retorna `sent: false` tanto para "não configurado" quanto
 * para "configurado mas falhou": quem chama decide se isso importa (ex.:
 * não marcar `confirmationEmailSentAt` quando `sent` for falso, para uma
 * tentativa futura poder reenviar).
 */
export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  if (!resend) {
    log.info("email", `[sem provedor configurado] seria enviado: "${input.subject}" -> ${input.to}`);
    return { sent: false };
  }
  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to: input.to, subject: input.subject, html: input.html });
    if (result.error) {
      log.error("email", "Resend recusou o envio", { error: result.error.message, to: input.to, subject: input.subject });
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    log.error("email", "Falha ao enviar e-mail", { error: String(err), to: input.to, subject: input.subject });
    return { sent: false };
  }
}
