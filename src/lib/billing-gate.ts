import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";

/**
 * A cobrança do painel está em vigor? (ADR-079) Só com `BILLING_GATE_ENFORCE=1`,
 * e nunca no Dev Runtime (a sessão de desenvolvimento não tem assinatura real).
 * Ligar esta variável em produção é o passo do lançamento que fecha o buraco
 * "o painel abre sem assinatura". Fica desligada por padrão para uma regra nova
 * nunca trancar, por surpresa, quem já usa o painel.
 */
export function billingGateEnforced(): boolean {
  return process.env.BILLING_GATE_ENFORCE === "1" && !isDevRuntimeEnabled();
}
