"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/5 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          Cartões NFC inteligentes para gestão de reputação
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
        >
          Transforme cada cliente satisfeito em uma nova avaliação.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance"
        >
          Um toque no cartão NFC leva o cliente direto para avaliar seu negócio no Google — e captura os problemas
          antes que virem uma avaliação ruim.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/sign-up">
            <Button size="lg" className="gap-2">
              Começar grátis
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <a href="#como-funciona">
            <Button size="lg" variant="outline" className="gap-2">
              <PlayCircle className="size-4" />
              Ver como funciona
            </Button>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="relative mt-16 w-full max-w-3xl"
        >
          <div className="aspect-video overflow-hidden rounded-2xl border border-black/5 bg-card shadow-2xl shadow-black/10">
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-muted/40 to-muted/10">
              <div className="flex items-center justify-center rounded-full bg-background/80 p-5 shadow-sm">
                <PlayCircle className="size-10 text-primary" />
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Vídeo demonstrativo em breve</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
