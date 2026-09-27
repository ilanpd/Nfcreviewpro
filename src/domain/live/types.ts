/**
 * Live Mode (Fase 6) — tipos compartilhados entre o produtor (o polling em
 * `services/live.service.ts`, que lê `RedirectLog`/`RatingEvent`/
 * `PrivateFeedback`/`AuditLog`) e o consumidor (o hook `useLiveConnection`
 * no cliente). Deliberadamente seu próprio módulo, sem importar nada de
 * `resolution-engine` ou `domain/table-map` — ver ADR-025.
 */

// "ORDER" (Fase 19.2) — pedido da loja física pago ou entregue, visível só
// no feed GLOBAL do Admin (`listGlobalRecentEvents`), nunca no Live Mode
// por-empresa (que é sobre o que acontece NUM salão, não sobre vendas).
export type LiveEventKind = "REDIRECT" | "RATING" | "FEEDBACK" | "ASSIGNMENT_CHANGED" | "ORDER";

export interface LiveEvent {
  id: string;
  kind: LiveEventKind;
  /** Cartão afetado — null para eventos que não são de um cartão específico
   * (ex.: uma atribuição em escopo de zona/empresa inteira, ou um pedido da
   * loja física). */
  cardId: string | null;
  /** Texto pronto para o feed de eventos, já em português — ver
   * domain/live/format.ts. */
  message: string;
  createdAt: number;
}

export type LiveConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";
