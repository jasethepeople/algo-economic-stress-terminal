import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  enableScenarioShare: vi.fn(), revokeScenarioShare: vi.fn(), recordReport: vi.fn(), createReportSchedule: vi.fn(), updateReportScheduleTask: vi.fn(), setReportScheduleEnabled: vi.fn(),
}));
const heartbeatMocks = vi.hoisted(() => ({ createHeartbeatJob: vi.fn(), updateHeartbeatJob: vi.fn() }));

vi.mock("./db", () => ({
  ...dbMocks, listStressScenarios: vi.fn(), getSharedScenario: vi.fn(), saveStressScenario: vi.fn(), getStressScenario: vi.fn(), listInboxReports: vi.fn(), listReportSchedules: vi.fn(), getReportSchedule: vi.fn(), getReportScheduleByTaskUid: vi.fn(), markScheduleRun: vi.fn(), getUserByOpenId: vi.fn(), upsertUser: vi.fn(), getDb: vi.fn(),
}));
vi.mock("./_core/heartbeat", () => heartbeatMocks);

import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner-1", name: "Owner", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: { cookie: "app_session_id=test-session" } } as TrpcContext["req"], res: { clearCookie: vi.fn() } as TrpcContext["res"] };
}

describe("authenticated collaboration flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.enableScenarioShare.mockImplementation(async (_id: number, _owner: string, token: string) => ({ shareToken: token }));
    dbMocks.createReportSchedule.mockResolvedValue({ id: 73 });
    heartbeatMocks.createHeartbeatJob.mockResolvedValue({ taskUid: "task-73", nextExecutionAt: "2026-08-22T09:00:00Z" });
  });

  it("creates and revokes a private share link, captures an inbox report, and activates a schedule", async () => {
    const caller = appRouter.createCaller(context());
    const share = await caller.scenarios.share({ id: 4 });
    await caller.scenarios.revokeShare({ id: 4 });
    await caller.reports.generateNow();
    const schedule = await caller.reports.createSchedule({ cadence: "daily" });

    expect(share.token).toHaveLength(24);
    expect(dbMocks.enableScenarioShare).toHaveBeenCalledWith(4, "owner-1", share.token);
    expect(dbMocks.revokeScenarioShare).toHaveBeenCalledWith(4, "owner-1");
    expect(dbMocks.recordReport).toHaveBeenCalledWith(expect.objectContaining({ ownerOpenId: "owner-1", title: "On-demand risk snapshot" }));
    expect(heartbeatMocks.createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({ cron: "0 0 9 * * *", path: "/api/scheduled/report-inbox" }), "test-session");
    expect(dbMocks.updateReportScheduleTask).toHaveBeenCalledWith(73, "owner-1", "task-73");
    expect(schedule.id).toBe(73);
  });
});
