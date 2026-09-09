import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseUserAgent } from "@/lib/device";
import { getRequestIp, hashIp } from "@/lib/ip";

export async function recordVisit(cardId: string, companyId: string, userAgent: string | null) {
  const { device, browser, os } = parseUserAgent(userAgent);
  const ip = await getRequestIp();

  // Vercel injects approximate geolocation headers at the edge for every
  // request in production — no external geo-IP service to pay for or call.
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  const city = h.get("x-vercel-ip-city");

  return prisma.visit.create({
    data: {
      cardId,
      companyId,
      device,
      browser,
      os,
      ipHash: hashIp(ip),
      country: country ? decodeURIComponent(country) : null,
      city: city ? decodeURIComponent(city) : null,
    },
  });
}
