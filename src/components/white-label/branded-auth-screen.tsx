import { Nfc } from "lucide-react";
import type { BrandConfig } from "@/domain/white-label/types";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { AuroraBackground } from "@nfc-os/ui";
import { NoiseTexture } from "@/components/ui/noise-texture";

/**
 * White Label (Fase 10) — moldura visual da tela de login/cadastro com
 * marca própria: fundo, logo e mensagem configuráveis por empresa (ver
 * `Company.loginHeadline`/`loginBackgroundUrl`), sem duplicar autenticação
 * — o componente `<SignIn>`/`<SignUp>` do Clerk continua sendo o único
 * responsável por autenticar; isto só estiliza a moldura ao redor dele via
 * a prop `appearance` oficial do Clerk. Ver ADR-041.
 *
 * Fase 14: o ambiente (Aurora + Noise) só aparece quando NÃO há empresa com
 * marca própria — nunca usamos os tokens `--brand`/`--chart-*` do NFC OS
 * por cima do fundo de uma empresa white-label, o que pareceria "marca
 * compartilhada" e violaria o Enterprise Brand Review. Uma empresa com
 * `loginBackgroundUrl` continua 100% dona do próprio fundo, como sempre.
 */
export function BrandedAuthScreen({ brand, children }: { brand: BrandConfig | null; children: React.ReactNode }) {
  const colors = buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor);
  const hasCustomBrand = brand !== null;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        backgroundColor: hasCustomBrand ? colors.secondary : undefined,
        backgroundImage: brand?.loginBackgroundUrl ? `url(${brand.loginBackgroundUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!hasCustomBrand && (
        <>
          <AuroraBackground variant="subtle" />
          <NoiseTexture className="absolute inset-0 -z-10 opacity-[0.03]" />
        </>
      )}

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {hasCustomBrand ? (
          <div className="flex flex-col items-center gap-3 text-center">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.name} className="h-12 w-auto object-contain" />
            ) : (
              <span className="text-lg font-semibold" style={{ color: colors.primary }}>
                {brand.name}
              </span>
            )}
            {brand.loginHeadline && <p className="max-w-xs text-sm text-muted-foreground">{brand.loginHeadline}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <Nfc className="size-5 text-brand" />
              NFC Review Pro
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Objeto `appearance` do Clerk derivado da marca — mesma paleta que o
 * resto do produto usa para essa empresa, nunca uma segunda fórmula de
 * cor. `undefined` quando não há marca própria, deixando o Clerk usar o
 * tema padrão do NFC OS sem nenhuma customização. */
export function clerkAppearanceFor(brand: BrandConfig | null) {
  if (!brand) return undefined;
  const colors = buildBrandColorSet(brand.primaryColor, brand.secondaryColor);
  return {
    variables: {
      colorPrimary: colors.primary,
    },
  };
}
