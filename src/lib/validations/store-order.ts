import { z } from "zod";
import { isValidCpfOrCnpj, isValidBrazilianPhone } from "@/domain/validation/br-documents";

/**
 * Motor de Ativação (Fase 18) — CPF (11 dígitos) ou CNPJ (14 dígitos).
 * Auditoria do Fluxo de Vendas (12/09/2026): antes checava só a QUANTIDADE
 * de dígitos, não o dígito verificador — "11111111111" passava. Agora valida
 * o dígito de verdade (mesmo algoritmo da Receita Federal), pra um documento
 * inválido nunca sobreviver até a hora de emitir nota fiscal, o pior momento
 * possível pra descobrir. Compartilhado entre o checkout da loja avulsa e o
 * checkout combinado (cartão + SaaS) — os dois precisam do mesmo dado.
 */
export const customerDocumentSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)")
      .refine(isValidCpfOrCnpj, "CPF ou CNPJ inválido — confira os números digitados")
  );

/** Auditoria do Fluxo de Vendas (12/09/2026): antes só exigia 10-20
 * caracteres, sem checar DDD nem formato — um typo passava direto, e esse é
 * o número usado pra contato se a produção travar. */
export const customerPhoneSchema = z
  .string()
  .trim()
  .min(10, "Informe o telefone com DDD")
  .max(20)
  .refine(isValidBrazilianPhone, "Informe um telefone brasileiro válido, com DDD");
