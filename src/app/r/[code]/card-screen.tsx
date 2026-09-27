"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import { BrandHeader } from "@/components/public/brand-header";
import { Button } from "@/components/ui/button";
import { isValidHexColor, readableTextColor } from "@/domain/white-label/color";
import { primaryButtonLabel } from "@/domain/return-offer/experience";
import { screenForTouch, screenHasCode, showsCodeEntry, type TouchScreen } from "@/domain/return-offer/public-screen";
import { demoApi, liveApi } from "@/lib/return-offer/client-api";
import { CodeEntry } from "./code-entry";
import { RedeemPanel } from "./redeem-panel";
import { NoticePanel, VoucherPanel } from "./voucher-panel";

interface CardScreenProps {
  code: string;
  company: { name: string; logoUrl: string | null; primaryColor: string };
  /** RETURN: com o brinde. BUTTONS: só os dois botões (Retorno pausado, sem campanha). */
  mode: "RETURN" | "BUTTONS";
  primaryUrl: string;
  /**
   * Só o modo de teste do dono: a mesma tela, respondendo com as regras do
   * domínio e sem gravar nada. Tudo serializável, porque vem de um componente
   * de servidor (as funções da API são criadas aqui, no navegador).
   */
  demo?: {
    stateId: string;
    title: string;
    timeZone: string;
    windowDays: number;
    nowIso: string;
    autoOverlay?: "entry" | "redeem";
    autoCode?: string;
    autoPin?: string;
  };
}

type Status = "loading" | "ready" | "failed";

/**
 * A tela do cartão (ADR-080), a mesma para todo cliente: o botão principal (o
 * destino do dono) e "Falar com a gente" aparecem sempre, na mesma ordem e com o
 * mesmo texto, e nunca esperam o brinde carregar. O brinde é um acréscimo:
 * qualquer falha o esconde e deixa os botões. Nada aqui lê ou pergunta nota.
 * Sem biblioteca de animação, de propósito: a página tem de abrir rápido no 4G.
 */
export function CardScreen({ code, company, mode, primaryUrl, demo }: CardScreenProps) {
  const api = useMemo(
    () =>
      demo
        ? demoApi(demo.stateId, { title: demo.title, timeZone: demo.timeZone, windowDays: demo.windowDays, now: new Date(demo.nowIso) })
        : liveApi(code),
    [demo, code]
  );
  const [status, setStatus] = useState<Status>("loading");
  const [visitId, setVisitId] = useState<string | null>(null);
  const [screen, setScreen] = useState<TouchScreen>({ kind: "NO_OFFER" });
  const [redeeming, setRedeeming] = useState(demo?.autoOverlay === "redeem");
  const [redeemedTitle, setRedeemedTitle] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const result = await api.touch();
    if (!result.ok) {
      setStatus("failed");
      return;
    }
    setVisitId(result.visitId);
    setScreen(screenForTouch(result.touch));
    setStatus("ready");
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const brandColor = isValidHexColor(company.primaryColor) ? company.primaryColor : null;
  const feedbackHref = visitId ? `/feedback?visit=${visitId}` : `/feedback?card=${encodeURIComponent(code)}`;
  const returnOn = mode === "RETURN";
  const showEntry = returnOn && status !== "loading" && !redeeming && !redeemedTitle && (showsCodeEntry(screen) || demo?.autoOverlay === "entry");

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <BrandHeader name={company.name} logoUrl={company.logoUrl} />

      {returnOn ? (
        <div className="w-full" aria-live="polite">
          {status === "loading" ? (
            <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" aria-label="Carregando seu brinde" role="status" />
          ) : redeemedTitle ? (
            <section className="w-full rounded-2xl border border-emerald-600/30 bg-emerald-50 p-5 text-left text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-5" aria-hidden />
                Brinde resgatado
              </div>
              <p className="mt-2 text-xl font-semibold">{redeemedTitle}</p>
              <p className="mt-1 text-sm opacity-80">Obrigado pela visita!</p>
            </section>
          ) : redeeming && screen.kind === "VOUCHER_READY" ? (
            <RedeemPanel
              api={api}
              code={screen.voucher.code}
              autoPin={demo?.autoPin}
              onCancel={() => setRedeeming(false)}
              onRedeemed={(title) => {
                setRedeeming(false);
                setRedeemedTitle(title);
              }}
            />
          ) : screenHasCode(screen) ? (
            <VoucherPanel screen={screen} companyName={company.name} onRedeem={() => setRedeeming(true)} />
          ) : (
            <NoticePanel screen={screen} />
          )}
          {status === "failed" ? (
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar seu brinde agora.{" "}
              <button type="button" onClick={() => void load()} className="font-medium text-brand-ink underline underline-offset-4">
                Tentar de novo
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid w-full gap-3">
        <a
          href={primaryUrl}
          rel="noopener"
          onClick={() => api.trackPrimaryClick(visitId)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          style={brandColor ? { backgroundColor: brandColor, color: readableTextColor(brandColor) } : { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {primaryButtonLabel(primaryUrl)}
          <ExternalLink className="size-4" aria-hidden />
        </a>
        <Button asChild variant="outline" className="h-12 gap-2 rounded-xl text-base">
          <Link href={feedbackHref}>
            <MessageCircle className="size-4" aria-hidden />
            Falar com a gente
          </Link>
        </Button>
      </div>

      {showEntry ? (
        <CodeEntry
          api={api}
          initiallyOpen={demo?.autoOverlay === "entry"}
          autoCode={demo?.autoCode}
          onFound={(found) => {
            setScreen(found);
            setRedeeming(false);
          }}
        />
      ) : null}
    </div>
  );
}
