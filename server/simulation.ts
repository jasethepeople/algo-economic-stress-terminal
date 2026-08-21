import {
  DEFAULT_SIMULATION_PARAMETERS,
  type AgentArchetype,
  type AgentPosition,
  type Candle,
  type MarketEvent,
  type OrderBookLevel,
  type ShockKind,
  type SimulationParameters,
  type SimulationSnapshot,
} from "../shared/simulation";

type InternalAgent = AgentPosition & {
  initialWealth: number;
  conviction: number;
};

type EngineState = {
  sessionId: string;
  parameters: SimulationParameters;
  agents: InternalAgent[];
  tick: number;
  price: number;
  previousPrice: number;
  peakPrice: number;
  supply: number;
  reserve: number;
  liquidity: number;
  imbalance: number;
  volume: number;
  candles: Candle[];
  events: MarketEvent[];
  survivalTrend: number[];
  activeShock: ShockKind | null;
  shockTicksRemaining: number;
  randomState: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 4) => Number(value.toFixed(digits));

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function seededRandom(state: EngineState) {
  state.randomState = (state.randomState * 1664525 + 1013904223) >>> 0;
  return state.randomState / 4294967296;
}

function normal(state: EngineState) {
  const u = Math.max(seededRandom(state), 1e-7);
  const v = Math.max(seededRandom(state), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function archetypeFor(index: number, count: number): AgentArchetype {
  const share = index / count;
  if (share < 0.24) return "Arbitrageur";
  if (share < 0.56) return "Liquidity Provider";
  return "Momentum";
}

function bondingPrice(supply: number, parameters: SimulationParameters) {
  const normalizedSupply = Math.max(0.05, supply / 5_000);
  return 12 + 26 * Math.pow(normalizedSupply, parameters.curveExponent);
}

function createState(parameters: SimulationParameters): EngineState {
  const count = Math.round(parameters.agentCount);
  const price = bondingPrice(5_000, parameters);
  const agents: InternalAgent[] = Array.from({ length: count }, (_, index) => {
    const archetype = archetypeFor(index, count);
    const inventory = 12 + (index % 13) * 3.2;
    const cash = parameters.seedCapital / count * (0.62 + (index % 17) / 95);
    const wealth = cash + inventory * price;
    return {
      id: `${archetype.split(" ")[0].slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      archetype,
      cash,
      inventory,
      wealth,
      pnl: 0,
      survival: 1,
      action: "HOLD",
      initialWealth: wealth,
      conviction: 0.35 + ((index * 37) % 61) / 100,
    };
  });

  return {
    sessionId: makeId("MKT"),
    parameters: { ...parameters },
    agents,
    tick: 0,
    price,
    previousPrice: price,
    peakPrice: price,
    supply: 5_000,
    reserve: parameters.initialLiquidity,
    liquidity: parameters.initialLiquidity,
    imbalance: 0,
    volume: 0,
    candles: [{ time: Date.now(), open: price, high: price, low: price, close: price, volume: 0 }],
    events: [],
    survivalTrend: [1],
    activeShock: null,
    shockTicksRemaining: 0,
    randomState: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
  };
}

export class MarketSimulation {
  private state: EngineState = createState(DEFAULT_SIMULATION_PARAMETERS);

  reset(parameters: SimulationParameters = this.state.parameters) {
    this.state = createState(this.normalizeParameters(parameters));
    return this.snapshot();
  }

  configure(next: SimulationParameters) {
    const normalized = this.normalizeParameters(next);
    if (normalized.agentCount !== this.state.parameters.agentCount) {
      return this.reset(normalized);
    }
    this.state.parameters = normalized;
    this.state.liquidity = clamp(this.state.liquidity, normalized.initialLiquidity * 0.04, normalized.initialLiquidity * 1.35);
    this.state.reserve = clamp(this.state.reserve, normalized.initialLiquidity * 0.04, normalized.initialLiquidity * 1.5);
    return this.snapshot();
  }

  shock(kind: ShockKind) {
    this.state.activeShock = kind;
    this.state.shockTicksRemaining = kind === "flash_crash" ? 18 : kind === "liquidity_drain" ? 26 : 14;
    this.pushEvent({ action: "SHOCK", agent: "SYSTEM", size: 0, price: this.state.price, note: kind.replace("_", " ").toUpperCase() });
    return this.snapshot();
  }

  getTickCadenceMs() {
    return this.state.parameters.tickCadenceMs;
  }

  replay(snapshot: SimulationSnapshot) {
    const restored = createState(this.normalizeParameters(snapshot.parameters));
    restored.sessionId = snapshot.sessionId;
    restored.tick = snapshot.tick;
    restored.price = snapshot.price;
    restored.previousPrice = snapshot.previousPrice;
    restored.peakPrice = Math.max(snapshot.price, snapshot.price / Math.max(1 - snapshot.risk.drawdown, 0.001));
    restored.supply = snapshot.supply;
    restored.reserve = snapshot.reserve;
    restored.liquidity = snapshot.liquidity;
    restored.imbalance = snapshot.imbalance;
    restored.volume = snapshot.volume;
    restored.candles = snapshot.candles.map(candle => ({ ...candle }));
    restored.events = snapshot.events.map(event => ({ ...event }));
    restored.activeShock = snapshot.activeShock;
    restored.shockTicksRemaining = snapshot.shockTicksRemaining;
    restored.survivalTrend = snapshot.risk.survivalTrend.length ? [...snapshot.risk.survivalTrend] : [snapshot.risk.survivalRate];
    restored.agents = snapshot.agents.map((agent, index) => ({ ...agent, initialWealth: Math.max(1, agent.wealth - agent.pnl), conviction: 0.35 + ((index * 37) % 61) / 100 }));
    this.state = restored;
    return this.snapshot();
  }

  tick() {
    const state = this.state;
    const parameters = state.parameters;
    state.tick += 1;
    const returnSignal = (state.price - state.previousPrice) / Math.max(state.previousPrice, 0.001);
    state.previousPrice = state.price;
    state.volume = 0;
    const curveValue = bondingPrice(state.supply, parameters);
    let netOrderFlow = 0;

    for (const agent of state.agents) {
      if (agent.survival <= 0) continue;
      const noise = normal(state) * parameters.volatility;
      const curveGap = (curveValue - state.price) / Math.max(state.price, 0.01);
      const cashFraction = agent.cash / Math.max(agent.wealth, 1);
      let signal = 0;

      if (agent.archetype === "Arbitrageur") {
        signal = curveGap * 3.1 + noise * 0.17;
      } else if (agent.archetype === "Liquidity Provider") {
        signal = -state.imbalance * 0.65 + curveGap * 0.55 + noise * 0.12;
      } else {
        signal = returnSignal * parameters.momentumAggression * 19 + state.imbalance * 0.85 + noise * 0.52;
      }

      const size = clamp((0.22 + Math.abs(signal) * 1.9) * agent.conviction, 0.08, 4.8);
      if (signal > 0.065 && agent.cash > state.price * size * 1.03 && cashFraction > 0.06) {
        this.execute(agent, "BUY", size);
        netOrderFlow += size;
      } else if (signal < -0.065 && agent.inventory > size * 0.85) {
        this.execute(agent, "SELL", size);
        netOrderFlow -= size;
      } else {
        agent.action = agent.archetype === "Liquidity Provider" ? "MAKE" : "HOLD";
      }
    }

    this.applyShock();
    const priceNoise = normal(state) * parameters.volatility * 0.008;
    const depth = Math.max(state.liquidity / Math.max(state.price, 1) / 2_400, 18);
    const flowImpact = (netOrderFlow / depth) * 0.022;
    const curvePull = ((bondingPrice(state.supply, parameters) - state.price) / Math.max(state.price, 1)) * 0.11;
    const rawMove = priceNoise + flowImpact + curvePull;
    state.price = Math.max(0.25, state.price * (1 + rawMove));
    state.peakPrice = Math.max(state.peakPrice, state.price);
    state.imbalance = clamp(state.imbalance * 0.86 + netOrderFlow / Math.max(depth, 1) * 0.14, -1, 1);
    state.liquidity = clamp(state.liquidity * (1 - Math.abs(rawMove) * 0.04) + state.reserve * 0.0009, parameters.initialLiquidity * 0.035, parameters.initialLiquidity * 1.38);
    this.updateWealth();
    this.updateCandle();
    return this.snapshot();
  }

  snapshot(): SimulationSnapshot {
    const risk = this.computeRisk();
    const orderBook = this.buildOrderBook();
    return {
      sessionId: this.state.sessionId,
      tick: this.state.tick,
      running: true,
      streamMode: "REQUEST-SCOPED",
      parameters: { ...this.state.parameters },
      price: round(this.state.price),
      previousPrice: round(this.state.previousPrice),
      spread: round((orderBook.asks[0]?.price ?? this.state.price) - (orderBook.bids[0]?.price ?? this.state.price), 4),
      volume: round(this.state.volume, 2),
      liquidity: round(this.state.liquidity, 2),
      supply: round(this.state.supply, 2),
      reserve: round(this.state.reserve, 2),
      imbalance: round(this.state.imbalance, 3),
      candles: this.state.candles.slice(-96),
      bids: orderBook.bids,
      asks: orderBook.asks,
      slippageCurve: [20, 60, 120, 250, 500, 900].map(size => ({
        size,
        impact: round((size / Math.max(this.state.liquidity / this.state.price, 1)) * (0.74 + Math.abs(this.state.imbalance) * 0.55) * 100, 2),
      })),
      agents: [...this.state.agents]
        .sort((a, b) => b.wealth - a.wealth)
        .map(({ initialWealth: _initialWealth, conviction: _conviction, ...agent }) => ({
          ...agent,
          cash: round(agent.cash, 2),
          inventory: round(agent.inventory, 2),
          wealth: round(agent.wealth, 2),
          pnl: round(agent.pnl, 2),
          survival: round(agent.survival, 2),
        })),
      risk,
      events: this.state.events.slice(0, 18),
      activeShock: this.state.activeShock,
      shockTicksRemaining: this.state.shockTicksRemaining,
    };
  }

  private normalizeParameters(parameters: SimulationParameters): SimulationParameters {
    return {
      agentCount: Math.round(clamp(parameters.agentCount, 24, 180)),
      volatility: clamp(parameters.volatility, 0.04, 0.98),
      curveExponent: clamp(parameters.curveExponent, 0.45, 3.1),
      taxRate: clamp(parameters.taxRate, 0, 6),
      initialLiquidity: clamp(parameters.initialLiquidity, 100_000, 4_000_000),
      seedCapital: clamp(parameters.seedCapital, 250_000, 12_000_000),
      momentumAggression: clamp(parameters.momentumAggression, 0.05, 1.5),
      tickCadenceMs: Math.round(clamp(parameters.tickCadenceMs, 180, 1_600)),
    };
  }

  private execute(agent: InternalAgent, action: "BUY" | "SELL", requestedSize: number) {
    const state = this.state;
    const tax = state.parameters.taxRate / 100;
    const instantaneousPrice = state.price * (1 + (action === "BUY" ? 1 : -1) * Math.abs(state.imbalance) * 0.004);
    let size = requestedSize;
    if (action === "BUY") {
      size = Math.min(size, agent.cash / (instantaneousPrice * (1 + tax)));
      const cost = size * instantaneousPrice * (1 + tax);
      agent.cash -= cost;
      agent.inventory += size;
      state.supply += size * 0.14;
      state.reserve += cost;
    } else {
      size = Math.min(size, agent.inventory);
      const proceeds = size * instantaneousPrice * (1 - tax);
      agent.cash += proceeds;
      agent.inventory -= size;
      state.supply = Math.max(120, state.supply - size * 0.1);
      state.reserve = Math.max(state.parameters.initialLiquidity * 0.025, state.reserve - proceeds * 0.22);
    }
    agent.action = action;
    state.volume += size * instantaneousPrice;
    if (size > 0.35 && seededRandom(state) > 0.42) {
      this.pushEvent({ action, agent: agent.id, size, price: instantaneousPrice, note: agent.archetype });
    }
  }

  private applyShock() {
    const state = this.state;
    if (!state.activeShock || state.shockTicksRemaining <= 0) {
      state.activeShock = null;
      state.shockTicksRemaining = 0;
      return;
    }
    const intensity = state.shockTicksRemaining / 26;
    if (state.activeShock === "flash_crash") {
      state.price *= 1 - (0.014 + intensity * 0.019);
      state.imbalance = clamp(state.imbalance - 0.16, -1, 1);
    } else if (state.activeShock === "liquidity_drain") {
      state.liquidity *= 1 - (0.018 + intensity * 0.022);
      state.reserve *= 1 - (0.004 + intensity * 0.006);
    } else {
      const dump = 52 * intensity;
      state.supply += dump * 0.18;
      state.price *= 1 - (0.009 + intensity * 0.014);
      state.imbalance = clamp(state.imbalance - 0.11, -1, 1);
      state.volume += dump * state.price;
    }
    state.shockTicksRemaining -= 1;
  }

  private updateWealth() {
    for (const agent of this.state.agents) {
      agent.wealth = Math.max(0, agent.cash + agent.inventory * this.state.price);
      agent.pnl = agent.wealth - agent.initialWealth;
      agent.survival = agent.wealth < agent.initialWealth * 0.12 ? 0 : 1;
    }
    const survival = this.state.agents.filter(agent => agent.survival > 0).length / this.state.agents.length;
    this.state.survivalTrend.push(survival);
    if (this.state.survivalTrend.length > 24) this.state.survivalTrend.shift();
  }

  private updateCandle() {
    const state = this.state;
    const current = state.candles[state.candles.length - 1];
    if (!current) return;
    current.high = Math.max(current.high, state.price);
    current.low = Math.min(current.low, state.price);
    current.close = state.price;
    current.volume += state.volume;
    if (state.tick % 2 === 0) {
      state.candles.push({ time: Date.now(), open: state.price, high: state.price, low: state.price, close: state.price, volume: 0 });
    }
    if (state.candles.length > 120) state.candles.shift();
  }

  private buildOrderBook(): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
    const state = this.state;
    const basis = Math.max(0.012, 0.026 + state.parameters.volatility * 0.025 + (1 - state.liquidity / state.parameters.initialLiquidity) * 0.018);
    let bidTotal = 0;
    let askTotal = 0;
    const bids = Array.from({ length: 10 }, (_, index) => {
      const depth = Math.max(2, (state.liquidity / state.price / 150) * (1.25 - index * 0.075) * (1 - state.imbalance * 0.24));
      bidTotal += depth;
      return { price: round(state.price * (1 - basis * (index + 1) / 9), 3), depth: round(depth, 2), total: round(bidTotal, 2) };
    });
    const asks = Array.from({ length: 10 }, (_, index) => {
      const depth = Math.max(2, (state.liquidity / state.price / 150) * (1.25 - index * 0.075) * (1 + state.imbalance * 0.24));
      askTotal += depth;
      return { price: round(state.price * (1 + basis * (index + 1) / 9), 3), depth: round(depth, 2), total: round(askTotal, 2) };
    });
    return { bids, asks };
  }

  private computeRisk() {
    const state = this.state;
    const wealths = state.agents.map(agent => agent.wealth).sort((a, b) => a - b);
    const totalWealth = wealths.reduce((sum, wealth) => sum + wealth, 0) || 1;
    const weighted = wealths.reduce((sum, wealth, index) => sum + (index + 1) * wealth, 0);
    const gini = clamp((2 * weighted) / (wealths.length * totalWealth) - (wealths.length + 1) / wealths.length, 0, 1);
    const survivalRate = state.agents.filter(agent => agent.survival > 0).length / state.agents.length;
    const drawdown = clamp((state.peakPrice - state.price) / Math.max(state.peakPrice, 1), 0, 1);
    const liquidityHealth = clamp(state.liquidity / state.parameters.initialLiquidity, 0, 1.4);
    const concentration = clamp(gini * 0.74 + Math.max(0, state.imbalance) * 0.11, 0, 1);
    const riskBase = clamp(0.05 + drawdown * 0.44 + (1 - liquidityHealth) * 0.24 + gini * 0.18 + (1 - survivalRate) * 0.36 + state.parameters.volatility * 0.16, 0, 0.98);
    const distribution: number[] = [];
    let collapseCount = 0;
    for (let path = 0; path < 42; path++) {
      let simulatedPrice = state.price;
      let simulatedLiquidity = liquidityHealth;
      let minimum = simulatedPrice;
      for (let horizon = 0; horizon < 16; horizon++) {
        const skew = -riskBase * 0.018 - Math.max(0, state.imbalance) * 0.003;
        simulatedPrice *= 1 + skew + normal(state) * state.parameters.volatility * 0.023;
        simulatedLiquidity *= 1 - Math.abs(normal(state)) * state.parameters.volatility * 0.012;
        minimum = Math.min(minimum, simulatedPrice);
      }
      const returnPct = (simulatedPrice - state.price) / Math.max(state.price, 1);
      distribution.push(round(returnPct * 100, 2));
      if (minimum < state.price * 0.62 || simulatedLiquidity < 0.2) collapseCount += 1;
    }
    const collapseProbability = clamp(collapseCount / 42 * 0.68 + riskBase * 0.32, 0, 1);
    return {
      collapseProbability: round(collapseProbability, 3),
      riskScore: round(collapseProbability * 100, 1),
      giniCoefficient: round(gini, 3),
      survivalRate: round(survivalRate, 3),
      liquidityHealth: round(liquidityHealth, 3),
      drawdown: round(drawdown, 3),
      concentration: round(concentration, 3),
      monteCarloDistribution: distribution,
      survivalTrend: state.survivalTrend.map(value => round(value, 3)),
    };
  }

  private pushEvent(event: Omit<MarketEvent, "id" | "time">) {
    this.state.events.unshift({ ...event, id: makeId("EVT"), time: Date.now(), size: round(event.size, 2), price: round(event.price, 3) });
    if (this.state.events.length > 24) this.state.events.pop();
  }
}

export const marketSimulation = new MarketSimulation();
