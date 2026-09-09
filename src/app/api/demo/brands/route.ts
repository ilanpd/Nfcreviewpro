import { NextResponse } from "next/server";
import { listWhiteLabelDemoBrands } from "@/lib/dev/demo-company";

/** White Label Live Switch (Fase 12) — lista fixa de marcas fictícias reais (ver seed). */
export async function GET() {
  const brands = await listWhiteLabelDemoBrands();
  return NextResponse.json({ brands });
}
