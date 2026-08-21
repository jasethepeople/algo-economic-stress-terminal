import { describe, expect, it } from "vitest";
import { DEFAULT_SIMULATION_PARAMETERS, type SimulationSnapshot } from "../shared/simulation";
import { buildScenarioComparison } from "../shared/scenarioComparison";

function makeSnapshot(parameters = DEFAULT_SIMULATION_PARAMETERS): SimulationSnapshot {
  return { sessionId: "comparison", tick: 1, running: true, streamMode: "REQUEST-SCOPED", parameters, price: 40, previousPrice: 40, spread: 0.2, volume: 20, liquidity: 1_000, supply: 100, reserve: 1_000, imbalance: 0, candles: [], bids: [], asks: [], slippageCurve: [], agents: [], events: [], activeShock: null, shockTicksRemaining: 0, risk: { collapseProbability: 0.1, riskScore: 10, giniCoefficient: 0.2, survivalRate: 0.9, liquidityHealth: 0.8, drawdown: 0.1, concentration: 0.2, monteCarloDistribution: [], survivalTrend: [0.9] } };
}

describe("buildScenarioComparison", () => {
  it("returns render-ready market, risk, and parameter deltas", () => {
    const left = makeSnapshot();
    const right = makeSnapshot({ ...DEFAULT_SIMULATION_PARAMETERS, taxRate: 1.25, agentCount: 100, initialLiquidity: 2_000_000 });
    right.price = 45; right.risk.riskScore = 22; right.risk.liquidityHealth = 0.6;
    const comparison = buildScenarioComparison(left, right);
    expect(comparison.metrics.find(row => row.label === "Mark")?.delta).toBe(5);
    expect(comparison.parameters.find(row => row.label === "Tax rate")?.delta).toBeCloseTo(0.6);
    expect(comparison.parameters.find(row => row.label === "Agent count")?.delta).toBe(16);
    expect(comparison.parameters).toHaveLength(7);
  });
});
