import { describe, expect, it } from "vitest";
import { computeStockForecast } from "./stock";

describe("computeStockForecast", () => {
  it("returns null days remaining when there was no consumption in the window", () => {
    expect(computeStockForecast(100, 0)).toEqual({ daysRemaining: null, dailyConsumption: 0 });
  });

  it("divides stock by the daily consumption rate", () => {
    // 28 cards over 14 days = 2/day; 100 in stock / 2 per day = 50 days.
    expect(computeStockForecast(100, 28)).toEqual({ daysRemaining: 50, dailyConsumption: 2 });
  });

  it("floors a fractional days-remaining result — never rounds up past what's actually there", () => {
    // 14 cards over 14 days = 1/day; 5 in stock / 1 per day = 5 days exactly.
    expect(computeStockForecast(5, 14).daysRemaining).toBe(5);
    // 7 cards over 14 days = 0.5/day; 5 in stock / 0.5 = 10 days.
    expect(computeStockForecast(5, 7).daysRemaining).toBe(10);
  });

  it("returns zero days remaining when stock is already at zero but consumption continues", () => {
    expect(computeStockForecast(0, 14).daysRemaining).toBe(0);
  });
});
