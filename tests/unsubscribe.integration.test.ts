/**
 * Unsubscribing from the email itself (2026-10-04). Settings had only a
 * "Turn on" button and the email's "fewer emails" link led there, so a
 * subscriber had no way to stop the reports at all.
 *
 * SKIPPED unless TEST_DATABASE_URL is set, like the other integration tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { AddressInfo } from "net";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_unsub_test";

let pool: any, server: any, base = "", lib: any;

describe.skipIf(!TEST_DB)("email unsubscribe (integration)", () => {
  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_DB;
    process.env["UNSUBSCRIBE_SECRET"] = "test-secret";
    pool = ((await import("@workspace/db")) as any).pool;
    lib = await import("../artifacts/api-server/src/lib/email.js");
    const express = (await import("../artifacts/api-server/node_modules/express/index.js" as any)).default;
    const router = (await import("../artifacts/api-server/src/routes/reports.js")).default;
    const app = express();
    app.use("/api", router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await pool.query(`DELETE FROM email_subscriptions WHERE tester_id = $1`, [TESTER]);
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM email_subscriptions WHERE tester_id = $1`, [TESTER]);
    await pool.query(`INSERT INTO email_subscriptions (tester_id, email, enabled) VALUES ($1, 'u@example.com', 'true')`, [TESTER]);
  });
  const enabled = async () => (await pool.query(`SELECT enabled FROM email_subscriptions WHERE tester_id = $1`, [TESTER])).rows[0].enabled;
  const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, "");

  it("the email's link turns the reports off, after a confirming POST", async () => {
    const url = lib.unsubscribeUrl("https://compass.day", TESTER);
    expect(url).toMatch(/^https:\/\/compass\.day\/api\/reports\/unsubscribe\?t=obs_unsub_test&k=/);
    // A mail scanner opening the link must not unsubscribe anyone.
    const page = await fetch(base + path(url));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Stop the emails");
    expect(await enabled()).toBe("true");
    // The button, and a mail client's one-click Unsubscribe, both POST.
    const done = await fetch(base + path(url), { method: "POST", body: "List-Unsubscribe=One-Click" });
    expect(done.status).toBe(200);
    expect(await enabled()).toBe("false");
  });

  it("a tester id without the right signature changes nothing", async () => {
    for (const k of ["", "x".repeat(32), lib.unsubscribeToken("obs_someone_else")]) {
      const r = await fetch(`${base}/api/reports/unsubscribe?t=${TESTER}&k=${k}`, { method: "POST" });
      expect(r.status).toBe(400);
    }
    expect(await enabled()).toBe("true");
  });

  it("the email carries the link and the one-click header", async () => {
    const { renderHtml } = await import("../artifacts/api-server/src/routes/reports.js");
    const html = renderHtml("Today", "Compass — today", [], { testerId: TESTER, span: "day" });
    expect(html).toContain(lib.unsubscribeUrl("https://compass.day", TESTER));
    expect(html).toContain(">unsubscribe</a>");
  });
});
