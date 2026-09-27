"use client";

import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { BRAND } from "@/lib/brand";

function toEmbedUrl(url: string): string | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function Hero({ heroVideoUrl }: { heroVideoUrl?: string | null }) {
  const embedUrl = heroVideoUrl ? toEmbedUrl(heroVideoUrl) : null;
  const isDirectVideo = !!heroVideoUrl && !embedUrl;

  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <BlurFade delay={0}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Cartões NFC para o seu negócio
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{BRAND.tagline}.</h1>
        </BlurFade>

        <BlurFade delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            O cliente encosta o celular no cartão, avalia no Google ou fala com você, e ganha um brinde para a próxima
            visita. Sem aplicativo, sem cadastro, e os mesmos caminhos para todo mundo.
          </p>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Começar grátis
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/#como-funciona">
              <Button size="lg" variant="outline" className="gap-2">
                <PlayCircle className="size-4" />
                Ver como funciona
              </Button>
            </Link>
          </div>
        </BlurFade>

        <BlurFade delay={0.25} offset={16} className="mt-16 w-full max-w-3xl">
          <div className="relative">
            <div className="aspect-video overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Vídeo demonstrativo"
                />
              ) : isDirectVideo ? (
                <video src={heroVideoUrl!} className="size-full object-cover" controls playsInline />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-muted/40 to-muted/10">
                  <div className="flex items-center justify-center rounded-full bg-background/80 p-5 shadow-sm">
                    <PlayCircle className="size-10 text-brand-ink" />
                  </div>
                  <p className="text-sm text-muted-foreground">Vídeo demonstrativo em breve</p>
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
