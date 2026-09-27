import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";
import { handleApiError } from "@/lib/api-error";

const overrideSchema = z.object({
  imageUrl: z.string().url().optional().or(z.literal("")),
  unitPriceCents: z.number().int().min(0).optional(),
});

const bodySchema = z.object({
  heroVideoUrl: z.string().url().optional().or(z.literal("")),
  storeProductOverrides: z.record(z.string(), overrideSchema).optional(),
  blankChipStock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const input = bodySchema.parse(await req.json());
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? "desconhecido";

    const settings = await updateSiteSettings(email, {
      heroVideoUrl: input.heroVideoUrl === "" ? null : input.heroVideoUrl,
      storeProductOverrides: input.storeProductOverrides,
      blankChipStock: input.blankChipStock,
      lowStockThreshold: input.lowStockThreshold,
    });

    // Home e Loja são páginas estáticas (cacheadas na CDN) — sem isto, a
    // mudança só apareceria no próximo deploy, quebrando a promessa desta
    // tela ("aparece direto no site público, sem deploy").
    revalidatePath("/");
    revalidatePath("/loja");

    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
