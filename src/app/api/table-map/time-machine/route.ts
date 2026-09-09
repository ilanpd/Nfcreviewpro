import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getSnapshotAt, getWindowSummary } from "@/services/time-machine.service";
import { handleApiError } from "@/lib/api-error";

const MAX_WINDOW_MINUTES = 180;

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const atParam = req.nextUrl.searchParams.get("at");
    const at = atParam ? new Date(atParam) : new Date();
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: "Parâmetro 'at' inválido" }, { status: 400 });
    }

    const windowMinutes = Math.min(MAX_WINDOW_MINUTES, Math.max(1, Number(req.nextUrl.searchParams.get("windowMinutes") ?? "30")));
    const windowStart = new Date(at.getTime() - windowMinutes * 60_000);

    const [snapshot, summary] = await Promise.all([
      getSnapshotAt(ctx.companyId, at),
      getWindowSummary(ctx.companyId, windowStart, at),
    ]);

    return NextResponse.json({ snapshot, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
