"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/public/brand-header";
import { StarRating } from "@/components/public/star-rating";
import type { PublicRatingResult } from "@/types";

interface RatingFlowProps {
  code: string;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
}

type Stage = { name: "rate" } | { name: "choose"; ratingEventId: string; googleReviewUrl: string };

/**
 * ADR-075 — depois da nota, TODO cliente vê exatamente a mesma tela: os mesmos
 * dois caminhos, na mesma ordem, com o mesmo texto, qualquer que seja a nota.
 * A nota é só dado interno; nada aqui pode ramificar por ela.
 */
export function RatingFlow({ code, companyName, logoUrl, primaryColor }: RatingFlowProps) {
  const router = useRouter();
  const [visitId, setVisitId] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>({ name: "rate" });
  const submittedRef = useRef(false);

  useEffect(() => {
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => setVisitId(data.visitId))
      .catch(() => {
        // Visit tracking is best-effort — the customer can still rate even
        // if this silently fails (offline blip, ad blocker, etc).
      });
  }, [code]);

  useEffect(() => {
    if (!visitId || selectedStars === null || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, stars: selectedStars }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((result: PublicRatingResult) => {
        setStage({ name: "choose", ratingEventId: result.ratingEventId, googleReviewUrl: result.googleReviewUrl });
      })
      .catch(() => {
        toast.error("Não foi possível registrar sua resposta. Tente novamente.");
        submittedRef.current = false;
        setSelectedStars(null);
      })
      .finally(() => setSubmitting(false));
  }, [visitId, selectedStars]);

  function handleGoogleClick() {
    if (stage.name !== "choose") return;
    fetch(`/api/ratings/${stage.ratingEventId}/redirect`, { method: "POST" }).catch(() => {});
    window.location.href = stage.googleReviewUrl;
  }

  function handleTalkClick() {
    if (stage.name !== "choose") return;
    router.push(`/feedback?event=${stage.ratingEventId}`);
  }

  return (
    <div className="w-full max-w-sm">
      <AnimatePresence mode="wait">
        {stage.name === "rate" ? (
          <motion.div
            key="rate"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-8"
          >
            <BrandHeader name={companyName} logoUrl={logoUrl} />
            <p className="text-center text-xl font-medium">Como foi sua experiência?</p>
            <StarRating onSelect={setSelectedStars} disabled={submitting} color={primaryColor} />
          </motion.div>
        ) : (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <BrandHeader name={companyName} logoUrl={logoUrl} />
            <div className="space-y-2">
              <p className="text-xl font-semibold">Obrigado!</p>
              <p className="text-muted-foreground">
                Se quiser, conte sua experiência no Google ou fale direto com a gente.
              </p>
            </div>
            <div className="grid w-full gap-3">
              <Button size="lg" className="gap-2" style={{ backgroundColor: primaryColor }} onClick={handleGoogleClick}>
                Avaliar no Google
                <ExternalLink className="size-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={handleTalkClick}>
                <MessageCircle className="size-4" />
                Falar com a gente
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
