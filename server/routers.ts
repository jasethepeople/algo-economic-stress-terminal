import { z } from "zod";
import { nanoid } from "nanoid";
import { parse as parseCookie } from "cookie";
import * as db from "./db";
import { CALIBRATION_ASSETS, CALIBRATION_RULES, getCalibrationReference } from "./calibration";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { marketSimulation } from "./simulation";
import { normalizeScenarioTags } from "./scenarioTags";
import { canReadSharedScenario } from "./shareLinks";

const parametersSchema = z.object({ agentCount: z.number().min(24).max(180), volatility: z.number().min(0.04).max(0.98), curveExponent: z.number().min(0.45).max(3.1), taxRate: z.number().min(0).max(6), initialLiquidity: z.number().min(100_000).max(4_000_000), seedCapital: z.number().min(250_000).max(12_000_000), momentumAggression: z.number().min(0.05).max(1.5), tickCadenceMs: z.number().int().min(180).max(1_600) });
const calibrationInput = z.object({ assets: z.array(z.enum(CALIBRATION_ASSETS)).min(1).max(3).optional(), rule: z.enum(CALIBRATION_RULES).optional() }).optional();
const ownerId = (value: string | null | undefined) => value as string;
const cronFor = (cadence: "daily" | "weekly") => cadence === "daily" ? "0 0 9 * * *" : "0 0 9 * * 1";

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  market: router({ snapshot: publicProcedure.query(() => marketSimulation.snapshot()), tick: publicProcedure.mutation(() => marketSimulation.tick()), configure: publicProcedure.input(parametersSchema).mutation(({ input }) => marketSimulation.configure(input)), reset: publicProcedure.input(parametersSchema.optional()).mutation(({ input }) => marketSimulation.reset(input)), shock: publicProcedure.input(z.object({ kind: z.enum(["flash_crash", "liquidity_drain", "whale_dump"]) })).mutation(({ input }) => marketSimulation.shock(input.kind)) }),
  calibration: router({ reference: publicProcedure.input(calibrationInput).query(({ input }) => getCalibrationReference(input?.assets, input?.rule)) }),
  scenarios: router({
    list: protectedProcedure.query(({ ctx }) => db.listStressScenarios(ownerId(ctx.user.openId))),
    shared: publicProcedure.input(z.object({ token: z.string().min(12).max(64) })).query(async ({ input }) => { const scenario = await db.getSharedScenario(input.token); if (!scenario || !canReadSharedScenario(scenario, input.token)) return null; return { name: scenario.name, tags: scenario.tags, parameters: scenario.parameters, snapshot: scenario.snapshot, createdAt: scenario.createdAt }; }),
    save: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(96), tags: z.array(z.string().max(20)).max(8).default([]) })).mutation(async ({ input, ctx }) => { const snapshot = marketSimulation.snapshot(); await db.saveStressScenario({ ownerOpenId: ownerId(ctx.user.openId), name: input.name.trim(), tags: normalizeScenarioTags(input.tags), parameters: snapshot.parameters, snapshot }); return { success: true } as const; }),
    load: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const scenario = await db.getStressScenario(input.id, ownerId(ctx.user.openId)); if (!scenario) throw new Error("Scenario not found in your private vault."); return marketSimulation.replay(scenario.snapshot); }),
    share: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const scenario = await db.enableScenarioShare(input.id, ownerId(ctx.user.openId), nanoid(24)); if (!scenario?.shareToken) throw new Error("Scenario share link could not be created."); return { token: scenario.shareToken }; }),
    revokeShare: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { await db.revokeScenarioShare(input.id, ownerId(ctx.user.openId)); return { success: true } as const; }),
  }),
  reports: router({
    inbox: protectedProcedure.query(({ ctx }) => db.listInboxReports(ownerId(ctx.user.openId))),
    generateNow: protectedProcedure.mutation(async ({ ctx }) => { const snapshot = marketSimulation.snapshot(); await db.recordReport({ ownerOpenId: ownerId(ctx.user.openId), title: "On-demand risk snapshot", snapshot }); return { success: true } as const; }),
    schedules: protectedProcedure.query(({ ctx }) => db.listReportSchedules(ownerId(ctx.user.openId))),
    createSchedule: protectedProcedure.input(z.object({ cadence: z.enum(["daily", "weekly"]) })).mutation(async ({ input, ctx }) => { const ownerOpenId = ownerId(ctx.user.openId); const cron = cronFor(input.cadence); const schedule = await db.createReportSchedule({ ownerOpenId, cadence: input.cadence, cronExpression: cron }); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; try { const job = await createHeartbeatJob({ name: `apex-report-${schedule.id}`, cron, path: "/api/scheduled/report-inbox", payload: { scheduleId: schedule.id }, description: `${input.cadence} in-app risk report for schedule ${schedule.id}` }, sessionToken); await db.updateReportScheduleTask(schedule.id, ownerOpenId, job.taskUid); return { id: schedule.id, nextExecutionAt: job.nextExecutionAt ?? null }; } catch (error) { await db.setReportScheduleEnabled(schedule.id, ownerOpenId, false); throw error; } }),
    setScheduleEnabled: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ input, ctx }) => { const ownerOpenId = ownerId(ctx.user.openId); const schedule = await db.getReportSchedule(input.id, ownerOpenId); if (!schedule?.scheduleCronTaskUid) throw new Error("Schedule has not been activated yet."); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: input.enabled }, sessionToken); await db.setReportScheduleEnabled(input.id, ownerOpenId, input.enabled); return { success: true } as const; }),
  }),
});
export type AppRouter = typeof appRouter;
