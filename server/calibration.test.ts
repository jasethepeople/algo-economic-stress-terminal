import { describe, expect, it } from "vitest";
import { deriveCalibration } from "./calibration";

const quotes = [{ symbol: "BTC" as const, priceUsd: 100_000, change24h: 4.2, volume24h: 10, updatedAt: 1 }, { symbol: "ETH" as const, priceUsd: 4_000, change24h: -2.4, volume24h: 10, updatedAt: 1 }, { symbol: "SOL" as const, priceUsd: 180, change24h: 6.8, volume24h: 10, updatedAt: 1 }];

describe("deriveCalibration", () => {
  it("converts reference-market moves into bounded terminal settings", () => { const suggestion = deriveCalibration(quotes); expect(suggestion.volatility).toBeGreaterThanOrEqual(0.04); expect(suggestion.volatility).toBeLessThanOrEqual(0.98); expect(suggestion.taxRate).toBeGreaterThanOrEqual(0); expect(suggestion.momentumAggression).toBeGreaterThanOrEqual(0.05); });
  it("changes suggestions by the selected calibration rule", () => { const defensive = deriveCalibration(quotes, "defensive"); const trend = deriveCalibration(quotes, "trend_follow"); expect(defensive.momentumAggression).toBeLessThan(trend.momentumAggression); expect(defensive.taxRate).toBeGreaterThan(trend.taxRate); });
});
