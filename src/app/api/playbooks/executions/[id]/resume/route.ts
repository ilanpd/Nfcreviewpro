import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { resumeScheduledExecution } from "@/services/recommendation-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    await resumeScheduledExecution(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
