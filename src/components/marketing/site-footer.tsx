import Link from "next/link";
import { Nfc } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
          <Nfc className="size-4" />
          NFC Review Pro
        </Link>
        <p>© {new Date().getFullYear()} NFC Review Pro. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
