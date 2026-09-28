import { Suspense } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { pageTitle } from "@/lib/brand";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StoreHero } from "./store-hero";
import { StoreProductGrid } from "./store-product-grid";
import { STORE_PRODUCTS, applyStoreProductOverrides } from "@/lib/store-products";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata = {
  title: pageTitle("Loja de cartões NFC"),
  description: "Cartões NFC premium com QR Code dinâmico, prontos para configurar em minutos. Sem contrato, sem burocracia.",
};

export default async function StorePage() {
  const settings = await getSiteSettings().catch(() => null);
  const products = applyStoreProductOverrides(STORE_PRODUCTS, settings?.storeProductOverrides);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <StoreHero />
        {/* C15 — `StoreProductGrid` lê `?produto=` (vindo de `/comecar`) via
            `useSearchParams()`, que exige um limite de Suspense pra não
            travar a pré-renderização estática do resto da página. */}
        <Suspense fallback={null}>
          <StoreProductGrid products={products} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
