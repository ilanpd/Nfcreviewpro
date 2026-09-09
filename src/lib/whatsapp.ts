const STARS_FILLED = "⭐";

interface FeedbackWhatsappInput {
  whatsapp: string;
  stars: number;
  message: string;
  name?: string | null;
  phone?: string | null;
  cardName: string;
  createdAt: Date;
}

/** Strips everything but digits so wa.me always gets a clean phone number. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildFeedbackWhatsappUrl({
  whatsapp,
  stars,
  message,
  name,
  phone,
  cardName,
  createdAt,
}: FeedbackWhatsappInput): string {
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(createdAt);

  const lines = [
    "Nova experiência registrada.",
    `Cartão: ${cardName}`,
    `Nota: ${STARS_FILLED.repeat(stars)}`,
    "Comentário:",
    `"${message}"`,
    `Cliente: ${name?.trim() || "Não informado"}`,
  ];

  if (phone?.trim()) lines.push(`Telefone: ${phone.trim()}`);
  lines.push(`Data: ${dateLabel}`);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${normalizePhone(whatsapp)}?text=${text}`;
}

/** Builds a wa.me deep link for a WHATSAPP-type Campaign destination — a
 * different use case from buildFeedbackWhatsappUrl (that one always talks to
 * the manager about a complaint; this one is whatever a campaign points a
 * customer at, e.g. "chat with us"). */
export function buildCampaignWhatsAppUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${normalizePhone(phone)}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
