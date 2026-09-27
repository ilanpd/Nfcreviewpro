import { z } from "zod";
import { findForbiddenRewardTerm, forbiddenRewardMessage } from "@/domain/return-offer/compliance";
import { isWeakPin } from "@/domain/return-offer/pin";

/** Texto do brinde: livre, mas nunca citando avaliação (ver domain/return-offer/compliance.ts). */
const rewardText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Use pelo menos ${min} caracteres.`)
    .max(max, `Use no máximo ${max} caracteres.`)
    .superRefine((value, ctx) => {
      const term = findForbiddenRewardTerm(value);
      if (term) ctx.addIssue({ code: "custom", message: forbiddenRewardMessage(term) });
    });

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Informe um link começando com https://");

export const offerInputSchema = z.object({
  title: rewardText(3, 60),
  description: rewardText(3, 140).nullable().optional(),
  windowDays: z.number().int().min(1).max(90),
  cooldownDays: z.number().int().min(0).max(365),
  dailyCap: z.number().int().min(1).max(10000).nullable().optional(),
  primaryUrl: httpUrl.nullable().optional(),
  active: z.boolean(),
});

export const pinInputSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "O PIN tem 4 números")
    .refine((pin) => !isWeakPin(pin), "PIN fácil demais (como 1234 ou 0000). Escolha outro."),
});

/** O que o atendente envia no resgate: o código do cartão da loja, o código do brinde e o PIN. */
export const redeemInputSchema = z.object({
  cardCode: z.string().trim().min(4).max(32),
  code: z.string().trim().min(1).max(20),
  pin: z.string().regex(/^\d{4}$/),
});

export const lookupInputSchema = z.object({
  cardCode: z.string().trim().min(4).max(32),
  code: z.string().trim().min(1).max(20),
});

export const voidInputSchema = z.object({
  reason: z.string().trim().min(3, "Explique o motivo em poucas palavras.").max(200, "Use no máximo 200 caracteres."),
});

export const voucherListQuerySchema = z.object({
  status: z.enum(["ISSUED", "REDEEMED", "EXPIRED", "VOIDED"]).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export type OfferInput = z.infer<typeof offerInputSchema>;
export type RedeemInput = z.infer<typeof redeemInputSchema>;
export type LookupInput = z.infer<typeof lookupInputSchema>;
