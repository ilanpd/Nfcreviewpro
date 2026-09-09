"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import Link from "next/link";
import { AnalyticsCard } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SNIPPETS: Record<string, string> = {
  curl: `curl https://sua-empresa.nfcos.app/api/v1/cards \\
  -H "Authorization: Bearer nfc_live_sua_chave"`,
  javascript: `import { NFCOS } from "@nfc-os/sdk";

const nfc = new NFCOS({ apiKey: process.env.NFC_API_KEY });
const { data: cards } = await nfc.cards.list();`,
  typescript: `import { NFCOS, type NFCCard } from "@nfc-os/sdk";

const nfc = new NFCOS({ apiKey: process.env.NFC_API_KEY! });
const { data: cards }: { data: NFCCard[] } = await nfc.cards.list();`,
  node: `const res = await fetch("https://sua-empresa.nfcos.app/api/v1/cards", {
  headers: { Authorization: \`Bearer \${process.env.NFC_API_KEY}\` },
});
const { data: cards } = await res.json();`,
};

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg bg-neutral-950 p-4">
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-100"
        onClick={() => {
          navigator.clipboard.writeText(code);
          toast.success("Copiado");
        }}
      >
        <Copy className="size-3.5" />
      </Button>
      <pre className="overflow-x-auto text-xs text-neutral-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocsPanel() {
  const [lang, setLang] = useState("curl");

  return (
    <div className="space-y-6">
      <AnalyticsCard title="Comece em 1 minuto" description="Instale o SDK ou chame a API diretamente — os dois falam o mesmo contrato.">
        <Tabs value={lang} onValueChange={setLang}>
          <TabsList>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="node">Node (fetch)</TabsTrigger>
          </TabsList>
          {Object.entries(SNIPPETS).map(([key, code]) => (
            <TabsContent key={key} value={key}>
              <CodeBlock code={code} />
            </TabsContent>
          ))}
        </Tabs>
      </AnalyticsCard>

      <AnalyticsCard title="Referência completa">
        <p className="text-sm text-muted-foreground">
          A documentação completa de todo endpoint, com exemplos ao vivo e um explorador de API, está no{" "}
          <Link href="/developers" target="_blank" className="text-brand underline">
            Playground de Desenvolvedores
          </Link>
          .
        </p>
      </AnalyticsCard>

      <AnalyticsCard title="Idempotência" description="Toda escrita (POST/PATCH/DELETE) aceita um header Idempotency-Key.">
        <CodeBlock
          code={`await nfc.cards.create(
  { name: "Mesa 12" },
  { idempotencyKey: crypto.randomUUID() }
);`}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Reenviar a mesma requisição com a mesma chave, dentro de 24h, devolve exatamente a mesma resposta em vez de criar um segundo cartão — útil para retries seguros depois de uma conexão cair.
        </p>
      </AnalyticsCard>
    </div>
  );
}
