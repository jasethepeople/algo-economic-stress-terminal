import type { Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { marketSimulation } from "./simulation";

export function shouldSkipScheduledRun(lastRunAt: Date | null, now = Date.now()) { return Boolean(lastRunAt && now - lastRunAt.getTime() < 120_000); }

export async function handleReportInboxSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await db.getReportScheduleByTaskUid(user.taskUid);
    if (!schedule || !schedule.enabled) return res.json({ ok: true, skipped: "orphan-or-paused" });
    if (shouldSkipScheduledRun(schedule.lastRunAt)) return res.json({ ok: true, skipped: "duplicate-retry" });
    const snapshot = marketSimulation.snapshot();
    await db.recordReport({ ownerOpenId: schedule.ownerOpenId, scheduleId: schedule.id, title: `${schedule.cadence === "daily" ? "Daily" : "Weekly"} risk snapshot`, snapshot });
    await db.markScheduleRun(schedule.id);
    return res.json({ ok: true, scheduleId: schedule.id, tick: snapshot.tick });
  } catch (error) {
    return res.status(500).json({ error: String(error), context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
