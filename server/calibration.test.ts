import { describe, expect, it } from "vitest";
import { deriveCalibration } from "./calibration";

describe("deriveCalibration", () => {
  it("converts a reference-market move into bounded terminal settings", () => {
    const suggestion = deriveCalibration([
      { symbol: "BTC", priceUsd: 100_000, change24h: 4.2, volume24h: 10, updatedAt: 1 },
      { symbol: "ETH", priceUsd: 4_000, change24h: -2.4, volume24h: 10, updatedAt: 1 },
      { symbol: "SOL", priceUsd: 180, change24h: 6.8, volume24h: 10, updatedAt: 1 },
    ]);

    expect(suggestion.volatility).toBeGreaterThanOrEqual(0.04);
    expect(suggestion.volatility).toBeLessThanOrEqual(0.98);
    expect(suggestion.taxRate).toBeGreaterThanOrEqual(0);
    expect(suggestion.momentumAggression).toBeGreaterThanOrEqual(0.05);
  });
});

