import { requireAuthContext } from "@/lib/auth";
import { listSupportRequestsForCompany } from "@/services/support.service";
import { SupportView } from "@/components/dashboard/support-view";

/** Central de Suporte (Fase 20) — ver services/support.service.ts. */
export default async function SupportPage() {
  const ctx = await requireAuthContext();
  const requests = await listSupportRequestsForCompany(ctx.companyId);
  return <SupportView initialRequests={requests} />;
}
