import { normalizeVoucherCode } from "@/domain/return-offer/code";
import { demoTouch, type DemoInput } from "@/domain/return-offer/public-screen";
import { redeemFailureMessage, type RedeemFailureReason } from "@/domain/return-offer/messages";
import type { PublicVoucherView, ReturnTouchView } from "@/domain/return-offer/view";

/**
 * As chamadas que a tela do cartão faz (ADR-080), atrás de uma interface, para o
 * modo de teste do dono usar a MESMA tela sem tocar no servidor: `liveApi` fala
 * com as rotas reais, `demoApi` responde com as regras do domínio e não grava nada.
 * Todas as chamadas são de melhor esforço do ponto de vista da tela: nenhuma falha
 * aqui pode impedir o cliente de seguir ao destino.
 */

export type TouchResponse = { ok: true; visitId: string | null; touch: ReturnTouchView | null } | { ok: false };

export type LookupResponse = { ok: true; voucher: PublicVoucherView } | { ok: false; message: string };

export type RedeemResponse =
  | { ok: true; title: string }
  | { ok: false; reason: RedeemFailureReason | "NETWORK"; message: string; remainingAttempts?: number; retryAt?: string };

export interface CardApi {
  touch(): Promise<TouchResponse>;
  lookup(code: string): Promise<LookupResponse>;
  redeem(code: string, pin: string): Promise<RedeemResponse>;
  trackPrimaryClick(visitId: string | null): void;
}

async function postJson(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> } | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    return null;
  }
}

export function liveApi(cardCode: string): CardApi {
  return {
    async touch() {
      const res = await postJson("/api/visits", { code: cardCode });
      if (!res || res.status >= 400) return { ok: false };
      return {
        ok: true,
        visitId: typeof res.data.visitId === "string" ? res.data.visitId : null,
        touch: (res.data.return as ReturnTouchView | null) ?? null,
      };
    },

    async lookup(code) {
      const res = await postJson("/api/vouchers/lookup", { cardCode, code });
      if (!res) return { ok: false, message: "Sem conexão. Tente de novo em instantes." };
      if (res.status === 200 && res.data.voucher) return { ok: true, voucher: res.data.voucher as PublicVoucherView };
      if (res.status === 429) return { ok: false, message: "Muitas tentativas. Aguarde um instante e tente de novo." };
      return { ok: false, message: redeemFailureMessage("NOT_FOUND") };
    },

    async redeem(code, pin) {
      const res = await postJson("/api/vouchers/redeem", { cardCode, code, pin });
      if (!res) return { ok: false, reason: "NETWORK", message: "Sem conexão. Tente de novo em instantes." };
      if (res.data.ok === true) return { ok: true, title: String(res.data.title ?? "") };
      const reason = (res.data.reason as RedeemFailureReason | undefined) ?? "UNAVAILABLE";
      return {
        ok: false,
        reason,
        message: typeof res.data.error === "string" ? res.data.error : redeemFailureMessage(reason),
        remainingAttempts: typeof res.data.remainingAttempts === "number" ? res.data.remainingAttempts : undefined,
        retryAt: typeof res.data.retryAt === "string" ? res.data.retryAt : undefined,
      };
    },

    trackPrimaryClick(visitId) {
      if (!visitId) return;
      // keepalive: a requisição termina mesmo com a página já navegando para o destino.
      try {
        fetch(`/api/visits/${visitId}/click`, { method: "POST", keepalive: true }).catch(() => {});
      } catch {
        // melhor esforço
      }
    },
  };
}

/** Código que o modo de teste reconhece: o de exemplo mostrado na tela. */
const DEMO_CODE = "K7X4QM";
const DEMO_WRONG_PIN = "0000";

export function demoApi(stateId: string, input: DemoInput): CardApi {
  const { touch, forceOffline } = demoTouch(stateId, input);
  return {
    async touch() {
      return forceOffline ? { ok: false } : { ok: true, visitId: null, touch };
    },
    async lookup(code) {
      const normalized = normalizeVoucherCode(code);
      if (normalized !== DEMO_CODE) return { ok: false, message: redeemFailureMessage("NOT_FOUND") };
      const sample = demoTouch("READY", input).touch;
      return sample && sample.state === "EXISTING" ? { ok: true, voucher: sample.voucher } : { ok: false, message: redeemFailureMessage("NOT_FOUND") };
    },
    async redeem(code, pin) {
      if (normalizeVoucherCode(code) !== DEMO_CODE) return { ok: false, reason: "NOT_FOUND", message: redeemFailureMessage("NOT_FOUND") };
      if (pin === DEMO_WRONG_PIN) return { ok: false, reason: "WRONG_PIN", message: redeemFailureMessage("WRONG_PIN"), remainingAttempts: 4 };
      return { ok: true, title: input.title };
    },
    trackPrimaryClick() {},
  };
}

