import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export interface StoreProductOverride {
  imageUrl?: string;
  unitPriceCents?: number;
}

export async function getSiteSettings() {
  return prisma.siteSettings.findUnique({ where: { id: SINGLETON_ID } });
}

export async function updateSiteSettings(
  updatedByEmail: string,
  data: {
    heroVideoUrl?: string | null;
    storeProductOverrides?: Record<string, StoreProductOverride>;
    blankChipStock?: number;
    lowStockThreshold?: number;
  }
) {
  const overridesJson = data.storeProductOverrides as Prisma.InputJsonValue | undefined;
  return prisma.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      updatedByEmail,
      heroVideoUrl: data.heroVideoUrl,
      storeProductOverrides: overridesJson,
      blankChipStock: data.blankChipStock,
      lowStockThreshold: data.lowStockThreshold,
    },
    update: {
      updatedByEmail,
      heroVideoUrl: data.heroVideoUrl,
      storeProductOverrides: overridesJson,
      blankChipStock: data.blankChipStock,
      lowStockThreshold: data.lowStockThreshold,
    },
  });
}

/** Motor de Ativação (Fase 18) — decrementa o estoque de chips em branco a
 * cada lote de `NFCCard` provisionado pela loja. Nunca bloqueia o
 * provisionamento em si (ficar negativo é só um sinal honesto de que a
 * contagem está desatualizada, não uma trava de sistema — ver comentário do
 * campo no schema). */
export async function decrementBlankChipStock(count: number) {
  return prisma.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, blankChipStock: -count },
    update: { blankChipStock: { decrement: count } },
  });
}

export function getStoreProductOverride(
  overrides: unknown,
  productId: string
): StoreProductOverride | undefined {
  if (!overrides || typeof overrides !== "object") return undefined;
  const map = overrides as Record<string, StoreProductOverride>;
  return map[productId];
}
