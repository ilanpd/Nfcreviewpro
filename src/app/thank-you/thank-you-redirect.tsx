"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function ThankYouRedirect({ whatsappUrl }: { whatsappUrl: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = whatsappUrl;
    }, 1500);
    return () => clearTimeout(timer);
  }, [whatsappUrl]);

  return (
    <Button variant="outline" onClick={() => (window.location.href = whatsappUrl)}>
      Abrir WhatsApp agora
    </Button>
  );
}
