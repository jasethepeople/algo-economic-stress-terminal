import { z } from "zod";
import * as db from "./db";
import { getCalibrationReference } from "./calibration";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { marketSimulation } from "./simulation";

const parametersSchema = z.object({
  agentCount: z.number().min(24).max(180), volatility: z.number().min(0.04).max(0.98), curveExponent: z.number().min(0.45).max(3.1), taxRate: z.number().min(0).max(6), initialLiquidity: z.number().min(100_000).max(4_000_000), seedCapital: z.number().min(250_000).max(12_000_000), momentumAggression: z.number().min(0.05).max(1.5), tickCadenceMs: z.number().int().min(180).max(1_600),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  market: router({
    snapshot: publicProcedure.query(() => marketSimulation.snapshot()), tick: publicProcedure.mutation(() => marketSimulation.tick()), configure: publicProcedure.input(parametersSchema).mutation(({ input }) => marketSimulation.configure(input)), reset: publicProcedure.input(parametersSchema.optional()).mutation(({ input }) => marketSimulation.reset(input)), shock: publicProcedure.input(z.object({ kind: z.enum(["flash_crash", "liquidity_drain", "whale_dump"]) })).mutation(({ input }) => marketSimulation.shock(input.kind)),
  }),
  calibration: router({ reference: publicProcedure.query(() => getCalibrationReference()) }),
  scenarios: router({
    list: protectedProcedure.query(({ ctx }) => db.listStressScenarios(ctx.user.openId as string)),
    save: protectedProcedure.input(z.object({ name: z.string().trim().min(3).max(96) })).mutation(async ({ input, ctx }) => { const snapshot = marketSimulation.snapshot(); await db.saveStressScenario({ ownerOpenId: ctx.user.openId as string, name: input.name, parameters: snapshot.parameters, snapshot }); return { success: true } as const; }),
    load: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const scenario = await db.getStressScenario(input.id, ctx.user.openId as string); if (!scenario) throw new Error("Scenario not found in your private vault."); return marketSimulation.replay(scenario.snapshot); }),
  }),
});

export type AppRouter = typeof appRouter;
