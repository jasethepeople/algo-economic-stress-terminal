export const CALIBRATION_ASSETS = ["BTC", "ETH", "SOL"] as const;
export type CalibrationAsset = (typeof CALIBRATION_ASSETS)[number];
export const CALIBRATION_RULES = ["balanced", "defensive", "trend_follow"] as const;
export type CalibrationRule = (typeof CALIBRATION_RULES)[number];

export type CalibrationQuote = { symbol: CalibrationAsset; priceUsd: number; change24h: number; volume24h: number; updatedAt: number; };
export type CalibrationReference = { source: "CoinGecko Keyless Public API"; asOf: number; cacheAgeMs: number; assets: CalibrationAsset[]; rule: CalibrationRule; quotes: CalibrationQuote[]; suggested: { volatility: number; taxRate: number; momentumAggression: number }; };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const assetToCoin: Record<CalibrationAsset, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };
let cached = new Map<string, CalibrationReference>();

export function deriveCalibration(quotes: CalibrationQuote[], rule: CalibrationRule = "balanced"): CalibrationReference["suggested"] {
  const averageAbsoluteMove = quotes.reduce((sum, quote) => sum + Math.abs(quote.change24h), 0) / Math.max(quotes.length, 1);
  const directionalMove = quotes.reduce((sum, quote) => sum + quote.change24h, 0) / Math.max(quotes.length, 1);
  const baseline = { volatility: 0.08 + averageAbsoluteMove / 14, taxRate: 0.25 + averageAbsoluteMove / 18, momentumAggression: 0.5 + directionalMove / 22 };
  const multiplier = rule === "defensive" ? { volatility: 0.82, taxRate: 1.28, momentumAggression: 0.68 } : rule === "trend_follow" ? { volatility: 1.12, taxRate: 0.84, momentumAggression: 1.35 } : { volatility: 1, taxRate: 1, momentumAggression: 1 };
  return { volatility: Number(clamp(baseline.volatility * multiplier.volatility, 0.04, 0.98).toFixed(2)), taxRate: Number(clamp(baseline.taxRate * multiplier.taxRate, 0, 6).toFixed(2)), momentumAggression: Number(clamp(baseline.momentumAggression * multiplier.momentumAggression, 0.05, 1.5).toFixed(2)) };
}

export async function getCalibrationReference(requestedAssets: CalibrationAsset[] = [...CALIBRATION_ASSETS], rule: CalibrationRule = "balanced"): Promise<CalibrationReference> {
  const assets: CalibrationAsset[] = requestedAssets.length ? Array.from(new Set(requestedAssets)) : Array.from(CALIBRATION_ASSETS);
  const key = `${assets.join(",")}:${rule}`;
  const now = Date.now();
  const prior = cached.get(key);
  if (prior && now - prior.asOf < 60_000) return { ...prior, cacheAgeMs: now - prior.asOf };
  const ids = assets.map(asset => assetToCoin[asset]).join(",");
  const endpoint = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Reference quote source unavailable (${response.status})`);
  const payload = await response.json() as Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number; last_updated_at?: number }>;
  const quotes = assets.map(symbol => { const item = payload[assetToCoin[symbol]]; if (!item || !Number.isFinite(item.usd)) throw new Error("Reference quote response was incomplete."); return { symbol, priceUsd: item.usd ?? 0, change24h: item.usd_24h_change ?? 0, volume24h: item.usd_24h_vol ?? 0, updatedAt: (item.last_updated_at ?? Math.floor(now / 1000)) * 1_000 }; });
  const reference = { source: "CoinGecko Keyless Public API" as const, asOf: now, cacheAgeMs: 0, assets, rule, quotes, suggested: deriveCalibration(quotes, rule) };
  cached.set(key, reference);
  return reference;
}
