import { describe, expect, it } from "vitest";
import { normalizeScenarioTags } from "./scenarioTags";
import { shouldSkipScheduledRun } from "./scheduledReports";
import { canReadSharedScenario } from "./shareLinks";

describe("collaboration and report scheduling guards", () => {
  it("keeps tags normalized for consistent sharing and comparison metadata", () => { expect(normalizeScenarioTags(["Systemic", "systemic", " Liquidity "])).toEqual(["systemic", "liquidity"]); });
  it("skips an immediate duplicate scheduled report retry", () => { expect(shouldSkipScheduledRun(new Date(Date.now() - 30_000))).toBe(true); expect(shouldSkipScheduledRun(new Date(Date.now() - 180_000))).toBe(false); });
  it("only permits an enabled matching read-only share token", () => { expect(canReadSharedScenario({ shareEnabled: true, shareToken: "valid-token-123" }, "valid-token-123")).toBe(true); expect(canReadSharedScenario({ shareEnabled: false, shareToken: "valid-token-123" }, "valid-token-123")).toBe(false); expect(canReadSharedScenario({ shareEnabled: true, shareToken: "valid-token-123" }, "wrong-token-456")).toBe(false); });
});
