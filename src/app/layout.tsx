import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Tipografia Pulse Smart Link (C11, ADR-086) — Bricolage Grotesque/Instrument
// Sans (ADR-077) saíram de propósito: legíveis, mas sem a precisão técnica
// que a nova direção visual pede. Space Grotesk assina os títulos (a mesma
// geometria angulosa de tech premium usada por produtos como o próprio
// Vercel), Inter carrega o corpo do texto (o padrão de facto de interface
// "invisível" — Linear, Stripe, Notion) — o stack de fallback inclui
// `-apple-system`, que resolve pra SF Pro de verdade em qualquer dispositivo
// Apple, sem precisar embutir uma fonte com licença restrita. IBM Plex Mono
// (ADR-077) continua para números e código: não fazia parte do problema.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Assets Inteligentes (Fase 10) — favicon/OG/manifest apontam para rotas
// dinâmicas (`/api/brand/*`) que resolvem a marca pelo Host da requisição
// (ver `lib/white-label/resolve-brand.ts`), nunca um arquivo estático — o
// `favicon.ico` estático que existia antes foi removido de propósito
// (ver ADR-043): um `<link rel="icon">` explícito tem prioridade sobre a
// convenção implícita `/favicon.ico` em todo navegador moderno, então
// manter os dois ao mesmo tempo arriscaria o navegador escolher o estático
// genérico em vez do dinâmico por marca.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  icons: {
    icon: "/api/brand/icon",
    apple: "/api/brand/icon?size=180",
  },
  openGraph: {
    images: ["/api/brand/og"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/api/brand/og"],
  },
  manifest: "/api/brand/manifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Dev Runtime (Fase 12, Self-Healing Development) — com `DEV_RUNTIME=1`,
  // `getAuthContext()` (lib/auth.ts) nunca chama o Clerk, então
  // `<ClerkProvider>` (que exige chaves reais para inicializar no cliente)
  // fica de fora inteiramente, de propósito e permanentemente — nunca mais
  // removido/religado à mão a cada fase. Ver ADR-052.
  // Dark mode (Fase 14, ADR-023/047/061) — `enableSystem` continua desligado
  // de propósito: uma ferramenta de trabalho não deveria trocar de tema
  // sozinha por causa do SO de quem está usando, só quando a pessoa escolhe
  // pelo toggle. `defaultTheme` vira "dark" no C11 (ADR-086): a nova direção
  // visual (preto profundo/grafite/violeta) foi desenhada escura-primeiro —
  // luz continua uma opção completa e testada, nunca de segunda classe, só
  // deixa de ser a primeira impressão de quem nunca escolheu nada ainda.
  // `storageKey` próprio (05/10/2026): a chave padrão do next-themes é `theme`, e
  // quem alternou para o claro em testes antigos continuava vendo o claro como
  // "primeira impressão" no próprio navegador. Uma chave nova descarta essas
  // preferências antigas uma única vez; daí em diante a escolha de cada pessoa
  // (claro ou escuro) é lembrada normalmente.
  const body = (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="pulse-theme">
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );

  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {isDevRuntimeEnabled() ? body : <ClerkProvider>{body}</ClerkProvider>}
      </body>
    </html>
  );
}
