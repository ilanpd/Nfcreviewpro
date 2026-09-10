import "server-only";

/**
 * Dev Tools Gate (Fase 13) — decide se `/dev/**`, os endpoints `/api/dev/**`
 * e o Chaos Engine (`lib/chaos/flags.ts`) ficam visíveis. Antes disso, todo
 * gate era `process.env.NODE_ENV === "production"` direto — mas o Next.js
 * define `NODE_ENV=production` em QUALQUER build implantado (`next build`),
 * Staging incluído, então essas ferramentas eram impossíveis de acionar em
 * qualquer ambiente implantado, não só em Produção. `ALLOW_DEV_TOOLS` é uma
 * env var nova e independente, dedicada só a isto: fica ausente (portanto
 * `false`) em todo projeto Vercel por padrão — inclusive Produção, que nunca
 * a define — e só é ligada explicitamente no projeto `nfc-os-staging`, o
 * único ambiente implantado onde não há cliente real. Ver ADR-057.
 */
export function devToolsEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEV_TOOLS === "true";
}
