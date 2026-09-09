/**
 * Impressão Profissional (Fase 10, bônus) — os 5 formatos pedidos, com
 * dimensões reais (em pontos PDF — 72pt = 1 polegada) para sair da
 * impressora no tamanho físico certo, não "do tamanho que a página A4
 * calhar de render". `cr80` é o tamanho padrão mundial de cartão PVC
 * (o mesmo de um cartão de crédito) — não inventado.
 */
export type PrintTemplateId = "sticker" | "pvc-card" | "table-tent" | "easel" | "plaque";

export interface PrintTemplateDef {
  id: PrintTemplateId;
  label: string;
  description: string;
  /** [largura, altura] em pontos PDF. */
  size: [number, number];
}

const MM_TO_PT = 2.834_645_67;
function mm(value: number): number {
  return Math.round(value * MM_TO_PT);
}

export const PRINT_TEMPLATES: Record<PrintTemplateId, PrintTemplateDef> = {
  sticker: {
    id: "sticker",
    label: "Adesivo de mesa",
    description: "5×5cm, para colar em qualquer superfície — balcão, vitrine, porta.",
    size: [mm(50), mm(50)],
  },
  "pvc-card": {
    id: "pvc-card",
    label: "Cartão PVC",
    description: "Tamanho padrão CR80 (85,6×54mm) — o mesmo de um cartão de crédito.",
    size: [mm(85.6), mm(53.98)],
  },
  "table-tent": {
    id: "table-tent",
    label: "Displex de mesa",
    description: "10×15cm em pé — para o centro da mesa, visível ao sentar.",
    size: [mm(100), mm(150)],
  },
  easel: {
    id: "easel",
    label: "Cavalete",
    description: "A4 — para um suporte de chão ou balcão, visível à distância.",
    size: [595.28, 841.89],
  },
  plaque: {
    id: "plaque",
    label: "Plaquinha",
    description: "8×12cm — para porta, quarto de hotel, ou parede.",
    size: [mm(80), mm(120)],
  },
};

export const PRINT_TEMPLATE_IDS = Object.keys(PRINT_TEMPLATES) as PrintTemplateId[];

export function isPrintTemplateId(value: string): value is PrintTemplateId {
  return value in PRINT_TEMPLATES;
}
