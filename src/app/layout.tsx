import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  title: "NFC Review Pro — Transforme clientes satisfeitos em avaliações",
  description:
    "Cartões NFC inteligentes que captam avaliações, atendimento e reputação para restaurantes, clínicas, academias e mais.",
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
  // Dark mode (Fase 14) — os tokens `.dark` existem desde a Fase 4.5
  // (ADR-023) mas nunca tinham sido ligados (`forcedTheme="light"` travava
  // tudo — ADR-047). `enableSystem` continua desligado de propósito: uma
  // ferramenta de trabalho não deveria trocar de tema sozinha por causa do
  // SO de quem está usando — só quando a pessoa escolhe, via o toggle. Ver
  // ADR-061.
  const body = (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {isDevRuntimeEnabled() ? body : <ClerkProvider>{body}</ClerkProvider>}
      </body>
    </html>
  );
}
