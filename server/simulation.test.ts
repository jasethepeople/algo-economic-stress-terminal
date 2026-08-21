import { describe, expect, it } from "vitest";
import { DEFAULT_SIMULATION_PARAMETERS } from "../shared/simulation";
import { MarketSimulation } from "./simulation";

describe("MarketSimulation", () => {
  it("preserves non-negative market invariants while agents trade", () => {
    const simulation = new MarketSimulation();
    simulation.reset(DEFAULT_SIMULATION_PARAMETERS);
    let snapshot = simulation.snapshot();
    for (let tick = 0; tick < 14; tick += 1) snapshot = simulation.tick();

    expect(snapshot.price).toBeGreaterThan(0);
    expect(snapshot.liquidity).toBeGreaterThan(0);
    expect(snapshot.candles.length).toBeGreaterThan(1);
    expect(snapshot.risk.collapseProbability).toBeGreaterThanOrEqual(0);
    expect(snapshot.risk.collapseProbability).toBeLessThanOrEqual(1);
    expect(snapshot.agents).toHaveLength(DEFAULT_SIMULATION_PARAMETERS.agentCount);
  });

  it("applies shocks and produces a bounded risk score", () => {
    const simulation = new MarketSimulation();
    simulation.reset({ ...DEFAULT_SIMULATION_PARAMETERS, volatility: 0.72 });
    const baseline = simulation.snapshot();
    simulation.shock("liquidity_drain");
    let stressed = baseline;
    for (let tick = 0; tick < 8; tick += 1) stressed = simulation.tick();

    expect(stressed.activeShock).toBe("liquidity_drain");
    expect(stressed.liquidity).toBeLessThan(baseline.liquidity);
    expect(stressed.risk.riskScore).toBeGreaterThanOrEqual(0);
    expect(stressed.risk.riskScore).toBeLessThanOrEqual(100);
  });

  it("reinitializes agent state when the population changes", () => {
    const simulation = new MarketSimulation();
    const snapshot = simulation.configure({ ...DEFAULT_SIMULATION_PARAMETERS, agentCount: 124 });
    expect(snapshot.agents).toHaveLength(124);
    expect(snapshot.tick).toBe(0);
  });

  it("serializes and replays a saved market snapshot", () => {
    const source = new MarketSimulation();
    source.reset({ ...DEFAULT_SIMULATION_PARAMETERS, tickCadenceMs: 480, seedCapital: 3_000_000 });
    source.shock("whale_dump");
    for (let tick = 0; tick < 5; tick += 1) source.tick();
    const saved = JSON.parse(JSON.stringify(source.snapshot()));

    const replay = new MarketSimulation();
    const restored = replay.replay(saved);

    expect(restored.tick).toBe(saved.tick);
    expect(restored.price).toBe(saved.price);
    expect(restored.parameters.tickCadenceMs).toBe(480);
    expect(restored.candles).toHaveLength(saved.candles.length);
    expect(restored.events).toHaveLength(saved.events.length);
  });
});
