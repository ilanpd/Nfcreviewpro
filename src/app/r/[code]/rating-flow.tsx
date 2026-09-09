"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
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

type Stage = { name: "rate" } | { name: "thanks-google"; ratingEventId: string; googleReviewUrl: string };

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
        if (result.outcome === "google") {
          setStage({ name: "thanks-google", ratingEventId: result.ratingEventId, googleReviewUrl: result.googleReviewUrl });
        } else {
          router.push(`/feedback?event=${result.ratingEventId}`);
        }
      })
      .catch(() => {
        toast.error("Não foi possível registrar sua avaliação. Tente novamente.");
        submittedRef.current = false;
        setSelectedStars(null);
      })
      .finally(() => setSubmitting(false));
  }, [visitId, selectedStars, router]);

  async function handleGoogleClick() {
    if (stage.name !== "thanks-google") return;
    fetch(`/api/ratings/${stage.ratingEventId}/redirect`, { method: "POST" }).catch(() => {});
    window.location.href = stage.googleReviewUrl;
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
            key="thanks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <BrandHeader name={companyName} logoUrl={logoUrl} />
            <div className="space-y-2">
              <p className="text-xl font-semibold">Que ótimo! 🎉</p>
              <p className="text-muted-foreground">
                Ficamos muito felizes com sua avaliação. Poderia compartilhá-la publicamente no Google?
              </p>
            </div>
            <Button size="lg" className="gap-2" style={{ backgroundColor: primaryColor }} onClick={handleGoogleClick}>
              Avaliar no Google
              <ExternalLink className="size-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
