import Link from "next/link";
import { Rocket } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * "Empresa criada, mas ainda não ativada" (C15) — quando `Company.activatedAt`
 * é nulo. Sem isto, uma empresa "pela metade" (sem WhatsApp/Google
 * configurados) ficaria invisível ao dono: o painel abre normalmente, mas o
 * cartão físico do cliente não tem pra onde apontar de verdade ainda.
 */
export function ActivationBanner() {
  return (
    <Alert role="status">
      <Rocket />
      <AlertTitle>Falta um passo pra ativar seu negócio</AlertTitle>
      <AlertDescription>
        WhatsApp e link de avaliação do Google ainda não foram configurados — sem eles, o cartão do seu cliente não tem pra onde ir.{" "}
        <Link href="/onboarding/ativar" className="font-medium underline underline-offset-4">
          Ativar agora
        </Link>
      </AlertDescription>
    </Alert>
  );
}
