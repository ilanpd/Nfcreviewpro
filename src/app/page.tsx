import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { DataShowcase } from "@/components/marketing/data-showcase";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { BentoFeatures } from "@/components/marketing/bento-features";
import { Comparison } from "@/components/marketing/comparison";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * Jornada comercial (C12, ADR-087): Hero (promessa) → prova de valor
 * (DataShowcase, "os toques viram dados") → funcionamento (o motor de
 * verdade) → ecossistema (o que o Starter entrega) → comparação (reduz a
 * objeção "isso não é só um QR Code?") → preços → FAQ → CTA final. Cada
 * seção existe pra preparar a próxima, nunca lado a lado sem ordem.
 */
export default async function LandingPage() {
  const settings = await getSiteSettings().catch(() => null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero heroVideoUrl={settings?.heroVideoUrl} />
        <DataShowcase />
        <HowItWorks />
        <BentoFeatures />
        <Comparison />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
