import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { devToolsEnabled } from "@/lib/dev/gate";
import { contrastRatio } from "@/domain/white-label/color";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const SWATCHES: { token: string; label: string; onToken?: string }[] = [
  { token: "background", label: "Fundo", onToken: "foreground" },
  { token: "card", label: "Cartão", onToken: "card-foreground" },
  { token: "muted", label: "Suave", onToken: "muted-foreground" },
  { token: "brand", label: "Violeta (acento)", onToken: "brand-foreground" },
  { token: "brand-subtle", label: "Violeta suave", onToken: "brand-ink" },
  { token: "secondary", label: "Secundário", onToken: "secondary-foreground" },
];

const HEX_TEXT_PAIRS: [string, string, string][] = [
  ["Tinta sobre branco", BRAND.colors.ink, BRAND.colors.paper],
  ["Grafite médio sobre branco", BRAND.colors.graphite, BRAND.colors.paper],
  ["Branco sobre violeta (texto de botão)", BRAND.colors.paper, BRAND.colors.violet],
  ["Tinta profunda sobre violeta claro (texto de botão no escuro)", BRAND.colors.ink, BRAND.colors.violetOnDark],
  ["Violeta puro sobre branco (ícone, nunca texto solto)", BRAND.colors.violet, BRAND.colors.paper],
];

/**
 * Página interna de referência do design system Pulse (ADR-077). Existe para
 * o time conferir tokens e componentes nos dois modos antes de uma tela nova;
 * fica atrás do mesmo portão das outras páginas de `/dev`.
 */
export default function DesignSystemPage() {
  if (!devToolsEnabled()) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-12 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <BrandWordmark className="text-3xl" />
          <p className="mt-2 text-sm text-muted-foreground">
            Referência do design system. Alterne o tema no botão ao lado para conferir os dois modos.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="cores" className="space-y-4">
        <h2 id="cores" className="text-xl font-semibold">Cores</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SWATCHES.map(({ token, label, onToken }) => (
            <div
              key={token}
              className="flex h-24 flex-col justify-between rounded-lg border p-3"
              style={{ backgroundColor: `var(--${token})`, color: onToken ? `var(--${onToken})` : undefined }}
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="font-mono text-xs">--{token}</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Par (modo claro)</TableHead>
                <TableHead className="text-right">Contraste</TableHead>
                <TableHead>Uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HEX_TEXT_PAIRS.map(([name, fg, bg]) => {
                const ratio = contrastRatio(fg, bg);
                return (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell className="text-right font-mono">{ratio.toFixed(2)}:1</TableCell>
                    <TableCell>
                      <Badge variant={ratio >= 4.5 ? "secondary" : "outline"}>{ratio >= 4.5 ? "Texto (AA)" : "Só decoração"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="tipografia" className="space-y-4">
        <h2 id="tipografia" className="text-xl font-semibold">Tipografia</h2>
        <div className="space-y-3 rounded-lg border p-5">
          <p className="font-heading text-4xl font-semibold tracking-tight">Títulos em Bricolage Grotesque</p>
          <p className="text-base">Texto corrido em Instrument Sans. O cliente encosta o celular no cartão e escolhe o que fazer.</p>
          <p className="font-mono text-sm">K7X-4QM · R$ 39,00 · 1.284 toques</p>
        </div>
      </section>

      <section aria-labelledby="componentes" className="space-y-6">
        <h2 id="componentes" className="text-xl font-semibold">Componentes</h2>

        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="destructive">Excluir</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Desativado</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>Ativo</Badge>
          <Badge variant="secondary">Pausado</Badge>
          <Badge variant="outline">Rascunho</Badge>
          <Badge variant="destructive">Erro</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cartão</CardTitle>
              <CardDescription>Superfície padrão para agrupar informação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Campo de texto" aria-label="Exemplo de campo" />
              <Button className="w-full">Salvar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabela</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cartão</TableHead>
                    <TableHead className="text-right">Toques</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Mesa 1</TableCell>
                    <TableCell className="text-right font-mono">128</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Balcão</TableCell>
                    <TableCell className="text-right font-mono">94</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          O ticket do brinde entra aqui quando o Retorno existir (C6). Os valores das tabelas acima são só de exemplo.
        </p>
      </section>
    </main>
  );
}
