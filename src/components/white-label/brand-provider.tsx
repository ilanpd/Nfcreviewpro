"use client";

import { createContext, useContext, useMemo } from "react";
import { buildBrandColorSet, type BrandColorSet } from "@/domain/white-label/color";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";
import type { BrandConfig } from "@/domain/white-label/types";

/**
 * White Label (Fase 10) — o único ponto de verdade de branding em runtime.
 * "Nada de cores espalhadas, tudo centralizado": qualquer componente que
 * precisa da cor/logo/marca de uma empresa lê `useBrand()`, nunca recebe
 * (ou pior, recalcula) essas variáveis por conta própria. Recebe o
 * `BrandConfig` já resolvido no servidor (Server Component) como prop —
 * nunca busca de novo no cliente — para não haver flash de cor padrão
 * antes da marca real aparecer (zero flicker de tema).
 *
 * Escopo desta fase: usado no layout do dashboard (marca da própria
 * empresa autenticada) e nas telas de login (marca resolvida por
 * `DomainResolver`) — os dois lugares novos que realmente precisam disso.
 * Componentes já estáveis como `AppSidebar` continuam recebendo `logoUrl`
 * por prop como sempre receberam; migrá-los para `useBrand()` é uma
 * limpeza futura de baixo risco, não uma reescrita justificada agora. Ver
 * ADR-040.
 */
interface BrandContextValue {
  brand: BrandConfig | null;
  colors: BrandColorSet;
}

const BrandContext = createContext<BrandContextValue | null>(null);

const CSS_VAR_STYLE_KEYS = ["--brand-primary", "--brand-secondary", "--brand-hover", "--brand-pressed", "--brand-on-primary"] as const;

export function BrandProvider({ brand, children }: { brand: BrandConfig | null; children: React.ReactNode }) {
  const colors = useMemo(() => buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor), [brand]);

  const style = useMemo(
    () =>
      ({
        [CSS_VAR_STYLE_KEYS[0]]: colors.primary,
        [CSS_VAR_STYLE_KEYS[1]]: colors.secondary,
        [CSS_VAR_STYLE_KEYS[2]]: colors.hoverPrimary,
        [CSS_VAR_STYLE_KEYS[3]]: colors.pressedPrimary,
        [CSS_VAR_STYLE_KEYS[4]]: colors.onPrimary,
      }) as React.CSSProperties,
    [colors]
  );

  return (
    <BrandContext.Provider value={{ brand, colors }}>
      {/* display:contents — carrega as variáveis CSS para os filhos sem
          adicionar uma caixa ao layout (nunca afeta flexbox/grid do pai). */}
      <div style={{ ...style, display: "contents" }}>{children}</div>
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand() precisa estar dentro de um <BrandProvider>.");
  return ctx;
}
