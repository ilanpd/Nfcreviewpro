/**
 * Resultado público de uma nota rápida (ADR-075).
 *
 * Contrato de compliance com a política do Google: o que o cliente vê depois
 * de tocar no cartão NUNCA pode depender da nota que ele deu. Por isso este
 * construtor não recebe `stars` — é estruturalmente impossível ramificar por
 * sentimento a partir dele. Todo cliente recebe os mesmos dois caminhos
 * (avaliar no Google e falar com o negócio).
 */
export interface PublicRatingResult {
  ratingEventId: string;
  googleReviewUrl: string;
}

export function buildPublicRatingResult(input: PublicRatingResult): PublicRatingResult {
  return { ratingEventId: input.ratingEventId, googleReviewUrl: input.googleReviewUrl };
}
