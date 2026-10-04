/**
 * The sorting fields on tasks (plan Part B, T1/T4/T5): a next step, where it
 * can happen, and being parked as someday or waiting. SKIPPED unless
 * TEST_DATABASE_URL is set, like the other integration tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { AddressInfo } from "net";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_tasks_sorting_test";

let pool: any, server: any, base = "";
const call = (path: string, method = "GET", body?: unknown) =>
  fetch(base + path, { method, headers: { "x-tester-id": TESTER, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

describe.skipIf(!TEST_DB)("task sorting fields (integration)", () => {
  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_DB;
    pool = ((await import("@workspace/db")) as any).pool;
    const express = (await import("../artifacts/api-server/node_modules/express/index.js" as any)).default;
    const router = (await import("../artifacts/api-server/src/routes/tasks.js")).default;
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => { server?.close(); await pool.query(`DELETE FROM tasks WHERE tester_id = $1`, [TESTER]); });
  beforeEach(async () => { await pool.query(`DELETE FROM tasks WHERE tester_id = $1`, [TESTER]); });

  it("stores and returns a next step and a place, trimmed", async () => {
    const r = await call("/tasks", "POST", { title: "Study herbs", nextStep: "  open the herbs book to p. 231 ", context: "home" });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ title: "Study herbs", nextStep: "open the herbs book to p. 231", context: "home", parkedAs: null });
  });

  it("clears a field with null and leaves an absent one alone", async () => {
    const { id } = await (await call("/tasks", "POST", { title: "Call the bank", nextStep: "find the number", context: "phone" })).json();
    const patched = await (await call(`/tasks/${id}`, "PATCH", { nextStep: null })).json();
    expect(patched).toMatchObject({ nextStep: null, context: "phone" });
  });

  it("parks as waiting with who and when, and clears all three together", async () => {
    const { id } = await (await call("/tasks", "POST", { title: "Contract back from Sam" })).json();
    const waiting = await (await call(`/tasks/${id}`, "PATCH", { parkedAs: "waiting", waitingOn: "Sam", checkBackOn: "2026-10-12" })).json();
    expect(waiting).toMatchObject({ parkedAs: "waiting", waitingOn: "Sam", checkBackOn: "2026-10-12" });
    const back = await (await call(`/tasks/${id}`, "PATCH", { parkedAs: null })).json();
    expect(back).toMatchObject({ parkedAs: null, waitingOn: null, checkBackOn: null });
  });

  it("keeps parked tasks in the list unless asked apart", async () => {
    await call("/tasks", "POST", { title: "Open one" });
    await call("/tasks", "POST", { title: "Maybe one day", parkedAs: "someday" });
    const titles = async (q: string) => (await (await call(`/tasks${q}`)).json()).map((t: any) => t.title).sort();
    expect(await titles("")).toEqual(["Maybe one day", "Open one"]);
    expect(await titles("?parked=exclude")).toEqual(["Open one"]);
    expect(await titles("?parked=only")).toEqual(["Maybe one day"]);
  });

  it("refuses what it cannot store instead of dropping it", async () => {
    for (const bad of [{ parkedAs: "later" }, { checkBackOn: "next tuesday" }, { checkBackOn: "2026-13-45" }, { nextStep: "x".repeat(301) }, { context: 5 }]) {
      const r = await call("/tasks", "POST", { title: "t", ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });
});
