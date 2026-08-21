import { describe, expect, it } from "vitest";
import { normalizeScenarioTags } from "./scenarioTags";

describe("normalizeScenarioTags", () => {
  it("trims, deduplicates, lowercases, and bounds private-vault tags", () => {
    expect(normalizeScenarioTags(["Baseline", "  stress  ", "baseline", "", "liquidity"])).toEqual(["baseline", "stress", "liquidity"]);
  });
});
