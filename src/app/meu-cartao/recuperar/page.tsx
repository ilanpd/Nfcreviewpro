import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = { title: "Recuperar link do cartão", robots: { index: false, follow: false } };

export default function RecoverPersonalLinkPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <RecoveryForm />
      </main>
      <SiteFooter />
    </div>
  );
}
