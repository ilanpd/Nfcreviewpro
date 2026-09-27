import { PLANS } from "@/lib/plans";

/**
 * Fase 21 — um só texto/lista de "por que assinar", derivado de `PLANS`
 * (nunca retipa a mesma lista de features à mão em 3 lugares que iam
 * divergindo com o tempo). Reaproveitado por `UpgradePitchCard`
 * (`components/upgrade-pitch.tsx`) em `/loja/sucesso` e
 * `meu-cartao-form.tsx`.
 */
export const UPGRADE_PITCH_HEADLINE = "Quer campanhas por horário, analytics e mapa de mesas?";

export function getUpgradePitchFeatures(): string[] {
  const starterHighlights = PLANS.STARTER.features.filter(
    (f) => f !== "1 cartão NFC" && f !== "Central de ajuda (self-service)"
  );
  const proHighlights = PLANS.PRO.features.filter((f) =>
    ["Campanhas customizadas", "Mapa de Mesas", "Analytics completo"].includes(f)
  );
  return [...starterHighlights, ...proHighlights];
}
