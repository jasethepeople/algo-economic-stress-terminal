export type CalibrationQuote = {
  symbol: "BTC" | "ETH" | "SOL";
  priceUsd: number;
  change24h: number;
  volume24h: number;
  updatedAt: number;
};

export type CalibrationReference = {
  source: "CoinGecko Keyless Public API";
  asOf: number;
  cacheAgeMs: number;
  quotes: CalibrationQuote[];
  suggested: { volatility: number; taxRate: number; momentumAggression: number };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
let cached: CalibrationReference | undefined;

export function deriveCalibration(quotes: CalibrationQuote[]): CalibrationReference["suggested"] {
  const averageAbsoluteMove = quotes.reduce((sum, quote) => sum + Math.abs(quote.change24h), 0) / Math.max(quotes.length, 1);
  const directionalMove = quotes.reduce((sum, quote) => sum + quote.change24h, 0) / Math.max(quotes.length, 1);
  return {
    volatility: Number(clamp(0.08 + averageAbsoluteMove / 14, 0.04, 0.98).toFixed(2)),
    taxRate: Number(clamp(0.25 + averageAbsoluteMove / 18, 0, 6).toFixed(2)),
    momentumAggression: Number(clamp(0.5 + directionalMove / 22, 0.05, 1.5).toFixed(2)),
  };
}

export async function getCalibrationReference(): Promise<CalibrationReference> {
  const now = Date.now();
  if (cached && now - cached.asOf < 60_000) return { ...cached, cacheAgeMs: now - cached.asOf };
  const endpoint = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true";
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Reference quote source unavailable (${response.status})`);
  const payload = await response.json() as Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number; last_updated_at?: number }>;
  const mapping: ["bitcoin" | "ethereum" | "solana", CalibrationQuote["symbol"]][] = [["bitcoin", "BTC"], ["ethereum", "ETH"], ["solana", "SOL"]];
  const quotes = mapping.map(([id, symbol]) => {
    const item = payload[id];
    if (!item || !Number.isFinite(item.usd)) throw new Error("Reference quote response was incomplete.");
    return { symbol, priceUsd: item.usd ?? 0, change24h: item.usd_24h_change ?? 0, volume24h: item.usd_24h_vol ?? 0, updatedAt: (item.last_updated_at ?? Math.floor(now / 1000)) * 1_000 };
  });
  cached = { source: "CoinGecko Keyless Public API", asOf: now, cacheAgeMs: 0, quotes, suggested: deriveCalibration(quotes) };
  return cached;
}
