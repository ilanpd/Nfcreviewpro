import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { BentoFeatures } from "@/components/marketing/bento-features";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSiteSettings } from "@/lib/site-settings";

export default async function LandingPage() {
  const settings = await getSiteSettings().catch(() => null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero heroVideoUrl={settings?.heroVideoUrl} />
        <HowItWorks />
        <BentoFeatures />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
