import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

// Explicit local scratch API only; never inherits a production endpoint.
const BASE = process.env.TIMING_TEST_API_URL;
if (
  BASE &&
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname)
)
  throw new Error("Timing integration tests require a local API");
type Account = { testerId: string; sessionToken: string };
const accounts: Account[] = [];
const q = {
  activity: "deep-work",
  start: "2026-09-05T05:00:00Z",
  end: "2026-09-07T05:00:00Z",
  timeZone: "America/Chicago",
  durationMinutes: 180,
};
async function request(
  path: string,
  body?: unknown,
  account?: Account,
  method = "POST",
) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(account
        ? {
            "x-tester-id": account.testerId,
            "x-session-token": account.sessionToken,
          }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: await r.json() };
}
describe.skipIf(!BASE)("timing HTTP on scratch", () => {
  let candidateId: string;
  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const testerId = `obs_timing_test_${randomUUID()}`;
      const r = await request(
        "/account/sync",
        { displayName: "Timing fixture" },
        { testerId, sessionToken: "" },
      );
      expect(r.status).toBe(201);
      accounts.push({ testerId, sessionToken: r.data.sessionToken });
    }
    const r = await request("/timing/search", q, accounts[0]);
    expect(r.status).toBe(200);
    expect(r.data.result.context.natal).toBe("absent");
    candidateId = r.data.candidates.find(
      (c: any) => !c.shortfall && c.suitability !== "defer",
    ).id;
  });
  afterAll(async () => {
    for (const account of accounts)
      expect(
        (
          await request(
            "/account",
            { confirm: "DELETE MY ACCOUNT" },
            account,
            "DELETE",
          )
        ).status,
      ).toBe(200);
  });
  it("requires an account and a valid claimed session", async () => {
    expect((await request("/timing/search", q)).status).toBe(400);
    expect(
      (
        await request("/timing/search", q, {
          ...accounts[0],
          sessionToken: "incorrect",
        })
      ).status,
    ).toBe(401);
  });
  it("saves concurrent retries once, with owner-scoped provenance", async () => {
    const choice = {
      query: q,
      candidateId,
      title: "Three hours of deep work",
      choiceKey: randomUUID(),
    };
    const replies = await Promise.all([
      request("/timing/choose", choice, accounts[0]),
      request("/timing/choose", choice, accounts[0]),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(replies[0].data.window.id).toBe(replies[1].data.window.id);
    expect(replies[0].data.window.goalId).toBe(null);
    expect(replies[0].data.window.timingProvenance.candidate.id).toBe(
      candidateId,
    );
    expect(
      (
        await request(
          "/timing/choose",
          { ...choice, title: "Changed request" },
          accounts[0],
        )
      ).status,
    ).toBe(409);
    const other = await request("/timing/choose", choice, accounts[1]);
    expect(other.status).toBe(201);
    expect(other.data.window.id).not.toBe(replies[0].data.window.id);
  });
  it("compares and saves a supplied time through the same endpoint", async () => {
    const query = {...q, candidateIntervals: [
      {start:"2026-09-05T15:00:00Z",end:"2026-09-05T18:00:00Z"},
      {start:"2026-09-06T15:00:00Z",end:"2026-09-06T18:00:00Z"},
    ]};
    const r = await request("/timing/search", query, accounts[0]);
    expect(r.data.result.interpretation.mode).toBe("comparison");
    expect(r.data.candidates).toHaveLength(2);
    const c = r.data.candidates.find((c:any)=>c.suitability!=="defer");
    const choice = {query,candidateId:c.id,title:"Compared time",choiceKey:randomUUID()};
    const saved = await request("/timing/choose", choice, accounts[0]);
    expect(saved.status).toBe(201);
    expect(saved.data.window.timingProvenance.candidate.evidence).toEqual(c.evidence);
    expect((await request("/timing/choose",choice,accounts[0])).data.window.id).toBe(saved.data.window.id);
    const malformed=await request("/timing/search",{...query,candidateIntervals:[{...query.candidateIntervals[0],activity:"first-date"},query.candidateIntervals[1]]},accounts[0]);
    expect(malformed.data.result.status).toBe("invalid");
  });
  it("rejects an invented candidate instead of persisting client evidence", async () => {
    const r = await request(
      "/timing/choose",
      {
        query: q,
        candidateId: "invented",
        title: "Fake",
        choiceKey: randomUUID(),
        evidence: { score: 100 },
      },
      accounts[0],
    );
    expect(r.status).toBe(409);
  });
  it("reports unlinked calendar context as unavailable and prevents a checked choice", async () => {
    const checked = { ...q, checkCalendar: true };
    const r = await request("/timing/search", checked, accounts[0]);
    expect(r.data.result.context.calendar.status).toBe("unavailable");
    expect(r.data.candidates[0].availability.status).toBe("unavailable");
    expect(
      (
        await request(
          "/timing/choose",
          {
            query: checked,
            candidateId,
            title: "Checked choice",
            choiceKey: randomUUID(),
          },
          accounts[0],
        )
      ).status,
    ).toBe(409);
  });
  it("bounds work and reports unsupported activities through HTTP", async () => {
    expect(
      (
        await request(
          "/timing/search",
          { ...q, end: "2026-10-07T05:00:00Z" },
          accounts[0],
        )
      ).data.result.code,
    ).toBe("horizon_exceeds_seven_civil_days");
    expect(
      (
        await request(
          "/timing/search",
          { ...q, activity: "made-up" },
          accounts[0],
        )
      ).data.result.status,
    ).toBe("unsupported");
  });
});
