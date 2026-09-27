import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SmartBadge, PremiumCardShell } from "@nfc-os/ui";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

/**
 * Escala real (Auditoria Nível Bilionário, 11/09/2026) — antes desta fase, um
 * `take: 200` fixo, sem busca nem paginação, fazia a 201ª empresa
 * simplesmente sumir da lista sem nenhum erro. Agora: busca por nome/slug e
 * paginação por página (`?q=`/`?page=`) — suficiente na escala real de um
 * painel administrativo (dezenas de milhares de linhas, não bilhões).
 */
export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q?.trim() ?? "";

  const where: Prisma.CompanyWhereInput = query
    ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] }
    : {};

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        accountType: true,
        stripeSubscriptionStatus: true,
        createdAt: true,
        _count: { select: { users: true, cards: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-sm text-muted-foreground">{total} no total{query ? ` — filtrado por "${query}"` : ""}.</p>
      </div>

      <form className="flex gap-2" action="/admin/empresas">
        <Input name="q" placeholder="Buscar por nome ou slug…" defaultValue={query} className="max-w-sm" />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>

      <PremiumCardShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Cartões</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link href={`/admin/empresas/${company.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
                      {company.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{company.slug}</div>
                  </TableCell>
                  <TableCell>
                    <SmartBadge
                      label={company.accountType === "GUEST" ? "Convidada" : "Assinante"}
                      tone={company.accountType === "GUEST" ? "warning" : "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <SmartBadge label={company.plan} tone={company.plan === "STARTER" ? "neutral" : "success"} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{company.stripeSubscriptionStatus ?? "—"}</TableCell>
                  <TableCell className="text-sm">{company._count.users}</TableCell>
                  <TableCell className="text-sm">{company._count.cards}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(company.createdAt))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </PremiumCardShell>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/empresas?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) })}`}>
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Anterior</Button>
            )}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/empresas?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) })}`}>
                  Próxima
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Próxima</Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
