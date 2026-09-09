import { NextResponse } from "next/server";
import { z } from "zod";
import { markRedirectedToGoogle } from "@/services/rating.service";
import { handleApiError } from "@/lib/api-error";

const paramsSchema = z.object({ id: z.string().cuid() });

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await params);
    await markRedirectedToGoogle(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
