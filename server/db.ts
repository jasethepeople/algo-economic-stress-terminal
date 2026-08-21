import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, stressScenarios, users } from "../drizzle/schema";
import type { SimulationParameters, SimulationSnapshot } from "../shared/simulation";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function saveStressScenario(input: { ownerOpenId: string; name: string; tags: string[]; parameters: SimulationParameters; snapshot: SimulationSnapshot; }) {
  const db = await getDb();
  if (!db) throw new Error("Scenario persistence is unavailable because the database is not connected.");
  await db.insert(stressScenarios).values(input);
}

export async function listStressScenarios(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stressScenarios).where(eq(stressScenarios.ownerOpenId, ownerOpenId)).orderBy(desc(stressScenarios.createdAt)).limit(24);
}

export async function getStressScenario(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(stressScenarios).where(and(eq(stressScenarios.id, id), eq(stressScenarios.ownerOpenId, ownerOpenId))).limit(1))[0];
}
