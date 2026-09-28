"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gift, LifeBuoy, Link2, MessageCircleHeart, Nfc, QrCode, Smartphone } from "lucide-react";
import { CursorGlow } from "@nfc-os/ui";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { formatVoucherCode } from "@/domain/return-offer/code";
import { PhoneFrame } from "./phone-frame";

/**
 * Quatro capacidades REAIS do produto — nunca recursos inventados para a
 * Landing parecer mais completa do que é. Os números/exemplos dentro de
 * cada mockup são ilustrativos (mesma convenção do "Rocket Rides" da
 * Stripe: uma prévia de produto, não uma promessa de resultado).
 *
 * C11 (ADR-086) — os dois blocos "quando crescer" (Analytics/Playbooks no
 * Pro, API/marca própria no Business) do C10 saíram: a operação hoje é
 * 100% Starter (Pro/Business congelados, sem venda ativa) — uma landing
 * pré-lançamento anunciando upgrade de plano que ninguém pode comprar
 * ainda é exatamente a "caixa que não faz sentido para o MVP" que a
 * direção visual pediu para cortar. Cada bloco que resta é uma coisa que
 * o cliente Starter realmente usa no primeiro dia — nada mais.
 *
 * C15 — o tile "Cartão NFC + QR Code" era só um ícone com espaço vazio
 * embaixo (achado real de auditoria: era o tile mais alto do grid, `md:
 * row-span-2`, com a maior parte do espaço sem propósito). Agora mostra a
 * funcionalidade real por trás do cartão (`domain/card-url`, `lib/qrcode`):
 * o mesmo endereço fixo funciona por toque OU por QR, o QR é gerado sob
 * demanda (nunca uma imagem fake — o SVG vem do mesmo gerador que
 * `/api/qr/[code]` usa em produção, computado uma vez no servidor em
 * `page.tsx` e passado como prop). O tile do Retorno ganhou um microloop
 * (código pronto → resgatado) ecoando em miniatura a mesma sequência real
 * do Hero — um fio visual entre as duas seções, não uma repetição do que
 * `DataShowcase` (a seção anterior, "os toques viram dados") já cobre.
 */

function RetornoBackground() {
  const code = formatVoucherCode("K7X4QM");
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setRedeemed((r) => !r), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-5 pt-16">
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background/90 p-4 shadow-premium backdrop-blur-sm">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Exemplo ilustrativo</p>
        <div className="flex items-center gap-3 rounded-lg bg-brand-subtle/40 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Sobremesa grátis</p>
            <p className="text-xs text-muted-foreground">Válida na próxima visita</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {redeemed ? (
            <motion.div
              key="redeemed"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Resgatado pelo cliente</span>
            </motion.div>
          ) : (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-border/60 px-3 py-2"
            >
              <span className="font-mono text-sm font-semibold tracking-wider text-foreground">{code}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Pronto pra resgatar
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FeatureLine({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-2.5 py-2 text-[11px] font-medium text-foreground shadow-subtle backdrop-blur-sm">
      <Icon className="size-3.5 shrink-0 text-brand-ink" />
      {text}
    </div>
  );
}

function CardTapBackground({ qrSvg }: { qrSvg: string }) {
  const [mode, setMode] = useState<"tap" | "scan">("tap");

  useEffect(() => {
    const id = setInterval(() => setMode((m) => (m === "tap" ? "scan" : "tap")), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center gap-4 p-5 pt-16">
      <PhoneFrame className="h-40 w-24">
        <AnimatePresence mode="wait">
          {mode === "tap" ? (
            <motion.div
              key="tap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="relative flex size-9 items-center justify-center rounded-full bg-brand/20">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" style={{ animationDuration: "1.8s" }} />
                <Nfc className="relative size-4 text-brand" strokeWidth={1.75} />
              </span>
              <p className="text-[9px] leading-tight text-white/50">Toque no cartão</p>
            </motion.div>
          ) : (
            <motion.div
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div className="rounded-md bg-white p-1" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="text-[9px] leading-tight text-white/50">ou escaneie o QR</p>
            </motion.div>
          )}
        </AnimatePresence>
      </PhoneFrame>
      <div className="w-full max-w-[11rem] space-y-2">
        <FeatureLine icon={Link2} text="Mesmo endereço, pra sempre" />
        <FeatureLine icon={QrCode} text="QR gerado na hora, em qualquer tamanho" />
      </div>
    </div>
  );
}

function FeedbackBackground() {
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="w-full max-w-xs space-y-2">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2 text-xs text-brand-foreground shadow-subtle">
          A fila hoje tava um pouco longa, mas o atendimento foi ótimo!
        </div>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm border border-border/60 bg-background/90 px-3.5 py-2 text-xs text-foreground shadow-subtle backdrop-blur-sm">
          Obrigado pelo retorno! Vamos abrir mais um caixa no horário de pico 🙏
        </div>
      </div>
    </div>
  );
}

function HelpBackground() {
  const rows = ["Como ativo o brinde?", "Perdi meu link, e agora?", "Cobrança atrasou, o que muda?"];
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="w-full max-w-sm space-y-2">
        {rows.map((row) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground shadow-subtle backdrop-blur-sm"
          >
            {row}
            <span className="text-muted-foreground">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BentoFeatures({ qrSvg }: { qrSvg: string }) {
  const features = [
    {
      name: "Retorno: o brinde que traz o cliente de volta",
      description: "Todo toque no cartão já sai com um código de brinde reservado pra próxima visita — sem cupom pra imprimir, sem aplicativo.",
      Icon: Gift,
      href: "/ajuda",
      cta: "Ver como funciona",
      background: <RetornoBackground />,
      // C15 — achado real de QA mobile: `row-span-2` só valia a partir de
      // `md`; sem ele no mobile (grid de 1 coluna, mas `auto-rows-[24rem]`
      // continua fixo), a tile só ganhava 1 linha de altura, e o mockup
      // (ancorado no topo, `pt-16`) ficava sobreposto ao ícone/título
      // (ancorado embaixo, `mt-auto`) — não tinha altura pra separar os
      // dois. `row-span-2` sem prefixo corrige em toda largura.
      className: "row-span-2 md:col-span-2 md:row-span-2",
    },
    {
      name: "Cartão NFC + QR Code",
      description: "Toque ou escaneie — funciona em qualquer celular, sem instalar nada.",
      Icon: Smartphone,
      href: "/comecar",
      cta: "Começar grátis",
      background: <CardTapBackground qrSvg={qrSvg} />,
      className: "row-span-2 md:col-span-1 md:row-span-2",
    },
    {
      name: "Canal de feedback privado",
      description: "Cliente insatisfeito fala direto com você no WhatsApp — nunca vira avaliação pública de 1 estrela.",
      Icon: MessageCircleHeart,
      href: "/comecar",
      cta: "Ver Mensagens",
      background: <FeedbackBackground />,
      className: "md:col-span-2 md:row-span-1",
    },
    {
      name: "Central de Ajuda",
      description: "Respostas diretas pro seu cliente e pra você, sem precisar abrir chamado.",
      Icon: LifeBuoy,
      href: "/ajuda",
      cta: "Ver a Central",
      background: <HelpBackground />,
      className: "md:col-span-1 md:row-span-1",
    },
  ] as const;

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Feito pra fazer o cliente voltar, não só avaliar
        </h2>
        <p className="mt-4 text-muted-foreground">
          O cartão físico, o brinde do Retorno e o canal de feedback — tudo incluído, desde o primeiro dia.
        </p>
      </div>

      <CursorGlow className="mt-16" color="var(--brand)" size={560}>
        <BentoGrid className="grid-cols-1 md:grid-cols-3">
          {features.map((feature) => (
            <BentoCard key={feature.name} {...feature} />
          ))}
        </BentoGrid>
      </CursorGlow>
    </section>
  );
}
