import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { BRAND } from "@/lib/brand";
import { AuroraBackground, CursorGlow, MagneticButton } from "@nfc-os/ui";
import { HeroMockup } from "./hero-mockup";

function toEmbedUrl(url: string): string | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

/**
 * Hero (C11, ADR-086) — reescrito de layout centralizado + placeholder de
 * vídeo vazio para duas colunas com uma cena viva (`HeroMockup`): o cartão
 * encosta, o motor resolve, o brinde aparece. Um vídeo real (Admin →
 * Conteúdo) continua tendo prioridade quando existir — a cena só é o
 * substituto honesto de um placeholder vazio, nunca compete com o vídeo
 * de verdade. `AuroraBackground`/`CursorGlow` (packages/ui, Fase 14,
 * nunca usados na Landing até aqui) entram pela primeira vez: o "vivo" que
 * a direção visual pede, sem nenhum componente novo pra manter.
 *
 * Server Component (Auditoria de Performance, 28/09/2026) — `toEmbedUrl` é
 * uma função pura e todo elemento interativo (AuroraBackground, CursorGlow,
 * MagneticButton, HeroMockup, BlurFade) já é "use client" por conta própria;
 * nada aqui precisava hidratar no cliente.
 */
export function Hero({ heroVideoUrl }: { heroVideoUrl?: string | null }) {
  const embedUrl = heroVideoUrl ? toEmbedUrl(heroVideoUrl) : null;
  const isDirectVideo = !!heroVideoUrl && !embedUrl;
  const hasRealVideo = !!embedUrl || isDirectVideo;

  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 sm:pt-28">
      <AuroraBackground variant="vivid" />
      <CursorGlow className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]" color="var(--brand)">
        <div className="text-center lg:text-left">
          <BlurFade delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              {BRAND.positioning}
            </div>
          </BlurFade>

          <BlurFade delay={0.05}>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{BRAND.tagline}.</h1>
          </BlurFade>

          <BlurFade delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-balance lg:mx-0">
              O cliente encosta o celular no cartão, avalia no Google ou fala com você, e ganha um brinde para a
              próxima visita. Sem aplicativo, sem cadastro, e os mesmos caminhos para todo mundo.
            </p>
          </BlurFade>

          <BlurFade delay={0.15}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {/* `asChild`: o Link É o botão (um só elemento interativo) — o padrão
                  antigo `<Link><Button/></Link>` gerava `<a><button>` aninhado:
                  HTML inválido, dois tab stops e leitura dobrada em leitor de tela. */}
              <MagneticButton asChild size="lg" className="gap-2">
                <Link href="/comecar">
                  Começar agora
                  <ArrowRight className="size-4" />
                </Link>
              </MagneticButton>
              <Button asChild size="lg" variant="outline">
                <Link href="/#como-funciona">Ver como funciona</Link>
              </Button>
            </div>
          </BlurFade>
        </div>

        <BlurFade delay={0.2} offset={16}>
          {hasRealVideo ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Vídeo demonstrativo"
                />
              ) : (
                <video src={heroVideoUrl!} className="size-full object-cover" controls playsInline />
              )}
            </div>
          ) : (
            <HeroMockup />
          )}
        </BlurFade>
      </CursorGlow>
    </section>
  );
}
