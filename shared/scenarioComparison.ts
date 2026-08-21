import type { SimulationSnapshot } from "./simulation";

export type ComparisonRow = {
  label: string;
  left: number;
  right: number;
  delta: number;
  format: "currency" | "percent" | "number" | "integer" | "milliseconds";
};

const parameterRows: { key: keyof SimulationSnapshot["parameters"]; label: string; format: ComparisonRow["format"] }[] = [
  { key: "volatility", label: "Volatility", format: "number" },
  { key: "taxRate", label: "Tax rate", format: "percent" },
  { key: "curveExponent", label: "Curve exponent", format: "number" },
  { key: "agentCount", label: "Agent count", format: "integer" },
  { key: "initialLiquidity", label: "Initial liquidity", format: "currency" },
  { key: "seedCapital", label: "Seed capital", format: "currency" },
  { key: "tickCadenceMs", label: "Tick cadence", format: "milliseconds" },
];

export function buildScenarioComparison(left: SimulationSnapshot, right: SimulationSnapshot) {
  const metrics: ComparisonRow[] = [
    { label: "Mark", left: left.price, right: right.price, delta: right.price - left.price, format: "currency" },
    { label: "Risk score", left: left.risk.riskScore, right: right.risk.riskScore, delta: right.risk.riskScore - left.risk.riskScore, format: "number" },
    { label: "Liquidity", left: left.risk.liquidityHealth, right: right.risk.liquidityHealth, delta: right.risk.liquidityHealth - left.risk.liquidityHealth, format: "percent" },
    { label: "Survival", left: left.risk.survivalRate, right: right.risk.survivalRate, delta: right.risk.survivalRate - left.risk.survivalRate, format: "percent" },
  ];
  const parameters = parameterRows.map(row => {
    const first = left.parameters[row.key];
    const second = right.parameters[row.key];
    return { label: row.label, left: first, right: second, delta: second - first, format: row.format };
  });
  return { metrics, parameters };
}
