import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("scenarios private vault", () => {
  it("requires an authenticated session before listing private scenarios", async () => {
    const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.scenarios.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
