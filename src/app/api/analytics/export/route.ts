import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getCompanyById } from "@/services/company.service";
import { buildAnalyticsReport, renderReportCsv, renderReportXlsx, renderReportPdf } from "@/services/export-engine.service";
import { handleApiError } from "@/lib/api-error";

const VALID_FORMATS = new Set(["csv", "xlsx", "pdf"]);

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const format = req.nextUrl.searchParams.get("format") ?? "csv";
    const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json({ error: "Formato de exportação inválido" }, { status: 400 });
    }

    const company = await getCompanyById(ctx.companyId);
    const report = await buildAnalyticsReport(ctx.companyId, company.name, days);
    const filenameBase = `relatorio-analytics-${Date.now()}`;

    if (format === "csv") {
      return new NextResponse(renderReportCsv(report), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filenameBase}.csv"` },
      });
    }

    if (format === "xlsx") {
      const buffer = await renderReportXlsx(report);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        },
      });
    }

    const buffer = await renderReportPdf(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filenameBase}.pdf"` },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
