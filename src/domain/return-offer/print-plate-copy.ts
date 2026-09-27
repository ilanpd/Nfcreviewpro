/**
 * Texto da placa impressa (F5 do plano: "Toque e ganhe"). Corrige um defeito
 * real: os templates de impressão (Fase 10) sempre diziam "Avalie sua
 * experiência", mesmo para um cartão que na verdade leva ao Instagram, ao
 * WhatsApp ou ao Retorno — a placa física prometia algo que o toque nem
 * sempre cumpria. Puro: recebe o que a tela pública decidiu mostrar
 * (\`domain/return-offer/experience.ts\`) e devolve só o texto.
 */
export interface PrintPlateCopy {
  headline: string;
  subheadline: string;
}

export function buildPrintPlateCopy(input: { returnActive: boolean; offerTitle: string | null; destinationLabel: string }): PrintPlateCopy {
  if (input.returnActive && input.offerTitle) {
    return { headline: "Toque e ganhe", subheadline: input.offerTitle };
  }
  return { headline: "Toque aqui", subheadline: input.destinationLabel };
}
