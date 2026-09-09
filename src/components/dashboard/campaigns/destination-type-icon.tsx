import {
  Camera,
  Layout,
  Link2,
  MessageCircle,
  Sparkles,
  Star,
  Ticket,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { CampaignType } from "@/generated/prisma/client";

export const DESTINATION_TYPE_ICON: Record<CampaignType, LucideIcon> = {
  REVIEW_FLOW: Star,
  URL_REDIRECT: Link2,
  GOOGLE_REVIEWS: Star,
  INSTAGRAM: Camera,
  TIKTOK: Video,
  DIGITAL_MENU: UtensilsCrossed,
  LANDING_PAGE: Layout,
  WHATSAPP: MessageCircle,
  COUPON: Ticket,
  AI_MENU: Sparkles,
};
