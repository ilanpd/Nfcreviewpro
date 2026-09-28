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
import { cardPublicUrl } from "@/lib/card-url";
import { generateQrSvg } from "@/lib/qrcode";

/**
 * Jornada comercial (C12, ADR-087): Hero (promessa) → prova de valor
 * (DataShowcase, "os toques viram dados") → funcionamento (o motor de
 * verdade) → ecossistema (o que o Starter entrega) → comparação (reduz a
 * objeção "isso não é só um QR Code?") → preços → FAQ → CTA final. Cada
 * seção existe pra preparar a próxima, nunca lado a lado sem ordem.
 */
export default async function LandingPage() {
  const settings = await getSiteSettings().catch(() => null);
  // C15 — o tile "Cartão NFC + QR Code" do Bento mostra um QR real, gerado
  // pelo mesmo caminho de `/api/qr/[code]` (`cardPublicUrl` é a única função
  // autorizada a montar o endereço `/r/<código>`, ADR-076) — nunca uma
  // imagem estática fingindo ser um QR. Computado uma vez aqui (servidor),
  // não no bundle do cliente.
  const illustrativeQrSvg = await generateQrSvg(cardPublicUrl("K7X4QM"), 96);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero heroVideoUrl={settings?.heroVideoUrl} />
        <DataShowcase />
        <HowItWorks />
        <BentoFeatures qrSvg={illustrativeQrSvg} />
        <Comparison />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
