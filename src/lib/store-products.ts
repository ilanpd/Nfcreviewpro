/**
 * Loja de cartões NFC físicos (Fase 15) — catálogo fixo, sem banco por trás
 * (o produto físico não muda com frequência o bastante para justificar uma
 * tabela/CRUD ainda). Preço por unidade cai com o volume — o pedido real de
 * "atrativo para quem compra 1x, 20x, 50x" — mas o valor exato é só um
 * placeholder de lançamento: quem operar a loja de verdade ajusta aqui.
 * `stripePriceId` fica de fora de propósito: compra avulsa usa
 * `price_data` inline no Checkout (ver /api/store/checkout), não um Price
 * pré-criado no Stripe, porque a quantidade (1/20/50) já define o valor.
 */
export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  badge?: string;
  highlighted?: boolean;
  imageUrl?: string;
}

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "single",
    name: "Cartão avulso",
    description: "1 cartão NFC premium com QR Code dinâmico — ideal para testar antes de escalar.",
    quantity: 1,
    unitPriceCents: 4900,
  },
  {
    id: "pack-20",
    name: "Pacote 20 unidades",
    description: "Para um restaurante, salão ou loja com várias mesas/pontos de contato.",
    quantity: 20,
    unitPriceCents: 3900,
    badge: "Recomendado",
    highlighted: true,
  },
  {
    id: "pack-50",
    name: "Pacote 50 unidades",
    description: "Para redes e operações com múltiplas unidades — o melhor preço por cartão.",
    quantity: 50,
    unitPriceCents: 2900,
  },
];

export function getStoreProduct(id: string): StoreProduct | undefined {
  return STORE_PRODUCTS.find((p) => p.id === id);
}

/** Painel Admin (Fase 16) — mescla preço/foto editados por cima do catálogo
 * fixo acima. Chamado tanto na vitrine (exibição) quanto no checkout (valor
 * cobrado de verdade) — os dois precisam ler exatamente o mesmo preço, nunca
 * um caminho que exibe um valor e cobra outro. */
export function applyStoreProductOverrides(
  products: StoreProduct[],
  overrides: unknown
): StoreProduct[] {
  if (!overrides || typeof overrides !== "object") return products;
  const map = overrides as Record<string, { imageUrl?: string; unitPriceCents?: number }>;
  return products.map((product) => {
    const override = map[product.id];
    if (!override) return product;
    return {
      ...product,
      imageUrl: override.imageUrl || product.imageUrl,
      unitPriceCents: override.unitPriceCents ?? product.unitPriceCents,
    };
  });
}

export function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
