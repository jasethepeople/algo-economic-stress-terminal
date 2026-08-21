export type AgentArchetype = "Arbitrageur" | "Liquidity Provider" | "Momentum";
export type ShockKind = "flash_crash" | "liquidity_drain" | "whale_dump";

export type SimulationParameters = {
  agentCount: number;
  volatility: number;
  curveExponent: number;
  taxRate: number;
  initialLiquidity: number;
  seedCapital: number;
  momentumAggression: number;
  tickCadenceMs: number;
};

export const DEFAULT_SIMULATION_PARAMETERS: SimulationParameters = {
  agentCount: 84,
  volatility: 0.36,
  curveExponent: 1.45,
  taxRate: 0.65,
  initialLiquidity: 1_250_000,
  seedCapital: 2_100_000,
  momentumAggression: 0.62,
  tickCadenceMs: 360,
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OrderBookLevel = {
  price: number;
  depth: number;
  total: number;
};

export type AgentPosition = {
  id: string;
  archetype: AgentArchetype;
  cash: number;
  inventory: number;
  wealth: number;
  pnl: number;
  survival: number;
  action: "BUY" | "SELL" | "MAKE" | "HOLD";
};

export type MarketEvent = {
  id: string;
  time: number;
  action: "BUY" | "SELL" | "SHOCK" | "SYSTEM";
  agent: string;
  size: number;
  price: number;
  note: string;
};

export type RiskMetrics = {
  collapseProbability: number;
  riskScore: number;
  giniCoefficient: number;
  survivalRate: number;
  liquidityHealth: number;
  drawdown: number;
  concentration: number;
  monteCarloDistribution: number[];
  survivalTrend: number[];
};

export type SimulationSnapshot = {
  sessionId: string;
  tick: number;
  running: boolean;
  streamMode: "REQUEST-SCOPED";
  parameters: SimulationParameters;
  price: number;
  previousPrice: number;
  spread: number;
  volume: number;
  liquidity: number;
  supply: number;
  reserve: number;
  imbalance: number;
  candles: Candle[];
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  slippageCurve: { size: number; impact: number }[];
  agents: AgentPosition[];
  risk: RiskMetrics;
  events: MarketEvent[];
  activeShock: ShockKind | null;
  shockTicksRemaining: number;
};

export type SavedScenario = {
  id: number;
  name: string;
  parameters: SimulationParameters;
  snapshot: SimulationSnapshot;
  createdAt?: Date;
};
