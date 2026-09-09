import "server-only";
import { format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { BreakdownItem, DashboardSummary, TimeseriesPoint } from "@/types";

export async function getDashboardSummary(companyId: string): Promise<DashboardSummary> {
  const [totalVisits, googleClicks, privateFeedbacks, activeCards, avgStars] = await Promise.all([
    prisma.visit.count({ where: { companyId } }),
    prisma.ratingEvent.count({ where: { companyId, redirectedGoogle: true } }),
    prisma.privateFeedback.count({ where: { companyId } }),
    prisma.nFCCard.count({ where: { companyId, active: true } }),
    prisma.ratingEvent.aggregate({ where: { companyId }, _avg: { stars: true } }),
  ]);

  return {
    totalVisits,
    googleClicks,
    privateFeedbacks,
    conversionRate: totalVisits > 0 ? googleClicks / totalVisits : 0,
    activeCards,
    averageStars: avgStars._avg.stars,
  };
}

function bucketKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/**
 * Everything the analytics page needs (daily timeseries + device/browser/
 * hour/location breakdowns) derived from a single indexed range query
 * (companyId + createdAt), rather than one round trip per chart.
 */
export async function getAnalytics(companyId: string, days = 30) {
  const since = startOfDay(subDays(new Date(), days - 1));

  const [visits, ratingEvents, feedbacks] = await Promise.all([
    prisma.visit.findMany({
      where: { companyId, createdAt: { gte: since } },
      select: { createdAt: true, device: true, browser: true, country: true, city: true },
    }),
    prisma.ratingEvent.findMany({
      where: { companyId, createdAt: { gte: since } },
      select: { createdAt: true, redirectedGoogle: true },
    }),
    prisma.privateFeedback.findMany({
      where: { companyId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const timeseriesMap = new Map<string, TimeseriesPoint>();
  for (let i = 0; i < days; i++) {
    const date = bucketKey(subDays(new Date(), days - 1 - i));
    timeseriesMap.set(date, { date, visits: 0, googleClicks: 0, feedbacks: 0 });
  }
  for (const v of visits) timeseriesMap.get(bucketKey(v.createdAt))!.visits += 1;
  for (const r of ratingEvents) if (r.redirectedGoogle) timeseriesMap.get(bucketKey(r.createdAt))!.googleClicks += 1;
  for (const f of feedbacks) timeseriesMap.get(bucketKey(f.createdAt))!.feedbacks += 1;

  const countBy = (values: (string | null)[]): BreakdownItem[] => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const label = value?.trim() || "Desconhecido";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const hourCounts = new Map<number, number>();
  for (const v of visits) {
    const hour = v.createdAt.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const byHour: BreakdownItem[] = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}h`,
    count: hourCounts.get(hour) ?? 0,
  }));

  return {
    timeseries: Array.from(timeseriesMap.values()),
    byDevice: countBy(visits.map((v) => v.device)),
    byBrowser: countBy(visits.map((v) => v.browser)),
    byLocation: countBy(visits.map((v) => (v.city && v.country ? `${v.city}, ${v.country}` : v.country))),
    byHour,
    totalInRange: visits.length,
  };
}
