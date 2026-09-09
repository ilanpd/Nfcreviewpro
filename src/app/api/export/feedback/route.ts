import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { listFeedback } from "@/services/feedback.service";
import { toCsv } from "@/lib/csv";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const feedback = await listFeedback(ctx.companyId);

    const rows = feedback.map((f) => ({
      data: f.createdAt.toISOString(),
      nota: f.ratingEvent.stars,
      nome: f.name ?? "",
      telefone: f.phone ?? "",
      mensagem: f.message,
      resolvido: f.resolved ? "sim" : "não",
      dispositivo: f.ratingEvent.visit.device ?? "",
    }));

    const csv = toCsv(rows, [
      { key: "data", header: "Data" },
      { key: "nota", header: "Nota" },
      { key: "nome", header: "Nome" },
      { key: "telefone", header: "Telefone" },
      { key: "mensagem", header: "Mensagem" },
      { key: "resolvido", header: "Resolvido" },
      { key: "dispositivo", header: "Dispositivo" },
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="feedbacks-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
