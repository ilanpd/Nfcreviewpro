import type { CampaignType } from "@/generated/prisma/client";
import { DESTINATION_META, SELECTABLE_CAMPAIGN_TYPES } from "@/domain/campaign/destination";
import { DESTINATION_TYPE_ICON } from "./destination-type-icon";
import { cn } from "@/lib/utils";

interface DestinationPickerProps {
  value: CampaignType | null;
  onChange: (type: CampaignType) => void;
}

export function DestinationPicker({ value, onChange }: DestinationPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SELECTABLE_CAMPAIGN_TYPES.map((type) => {
        const meta = DESTINATION_META[type];
        const Icon = DESTINATION_TYPE_ICON[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50",
              selected && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
          >
            <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
