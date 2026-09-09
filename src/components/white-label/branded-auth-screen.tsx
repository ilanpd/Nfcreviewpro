import type { BrandConfig } from "@/domain/white-label/types";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";
import { buildBrandColorSet } from "@/domain/white-label/color";

/**
 * White Label (Fase 10) — moldura visual da tela de login/cadastro com
 * marca própria: fundo, logo e mensagem configuráveis por empresa (ver
 * `Company.loginHeadline`/`loginBackgroundUrl`), sem duplicar autenticação
 * — o componente `<SignIn>`/`<SignUp>` do Clerk continua sendo o único
 * responsável por autenticar; isto só estiliza a moldura ao redor dele via
 * a prop `appearance` oficial do Clerk. Ver ADR-041.
 */
export function BrandedAuthScreen({ brand, children }: { brand: BrandConfig | null; children: React.ReactNode }) {
  const colors = buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor);
  const hasCustomBrand = brand !== null;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundColor: hasCustomBrand ? colors.secondary : undefined,
        backgroundImage: brand?.loginBackgroundUrl ? `url(${brand.loginBackgroundUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {hasCustomBrand && (
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
