import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Ver comentário de global-error.tsx — mesma lacuna, cobrindo o caso de
 * uma URL que não corresponde a nenhuma rota (antes caía no 404 genérico
 * do Next.js, sem marca nenhuma). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">Página não encontrada</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </main>
  );
}
