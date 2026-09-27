import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StoreHero } from "./store-hero";
import { StoreProductGrid } from "./store-product-grid";
import { STORE_PRODUCTS, applyStoreProductOverrides } from "@/lib/store-products";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata = {
  title: "Loja de cartões NFC — NFC OS",
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
        <StoreProductGrid products={products} />
      </main>
      <SiteFooter />
    </div>
  );
}
