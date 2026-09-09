import { DISPLAY_STATUS_LABEL, type DisplayStatus } from "@/domain/campaign/status";
import { SmartBadge } from "@nfc-os/ui";

const TONE: Record<DisplayStatus, "neutral" | "warning" | "success" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "warning",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "info",
  ARCHIVED: "neutral",
};

/** Wrapper fino sobre o Badge Inteligente do NFC OS Design Language —
 * mantém a mesma API que as telas já usam. ACTIVE pulsa: é o único status
 * que significa "acontecendo agora". */
export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return <SmartBadge label={DISPLAY_STATUS_LABEL[status]} tone={TONE[status]} pulse={status === "ACTIVE"} className={className} />;
}
