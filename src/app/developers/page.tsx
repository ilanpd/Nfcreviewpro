import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PlaygroundView } from "@/components/marketing/developers/playground-view";
import { DEMO_API_KEY } from "@/domain/api-v1/demo-key";

export const metadata: Metadata = {
  title: "Desenvolvedores — API pública do NFC OS",
  description: "Documentação, SDK e um explorador de API ao vivo para integrar com o NFC OS.",
};

/**
 * Playground público (Fase 9) — `DEMO_API_KEY` é, de propósito, uma chave
 * fixa e somente-leitura semeada contra a empresa de demonstração Bella
 * Vista (ver `domain/api-v1/demo-key.ts`), segura para aparecer em uma
 * página pública: mesmo que alguém a copie, ela só consegue ler dados
 * fictícios de demonstração, nunca escrever nada.
 */
export default function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PlaygroundView demoApiKey={DEMO_API_KEY} />
      </main>
      <SiteFooter />
    </div>
  );
}
