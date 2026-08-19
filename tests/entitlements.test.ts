import { describe, it, expect } from "vitest";
import {
  can, effectivePlan, entitlementFor, NEVER_GATED, TRIAL_DAYS,
  type Feature, type Plan,
} from "../artifacts/api-server/src/lib/entitlements";

/**
 * THE FREE/PAID LINE (artifacts/tides/DECISION-PRICING-2026-08-19).
 *
 * Free answers "now", paid answers "when, across a horizon". These pin the
 * parts of that decision that are easiest to erode by accident — the three
 * amendments especially, which exist because each is a lever someone would
 * reach for later without remembering why it was refused.
 */

const NOW = new Date("2026-08-19T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("which plan an account is actually on", () => {
  it("treats a lapsed trial as free, on read", () => {
    // Computed on read, never swept by a job: an account whose trial ended at
    // midnight must not keep paid compute until some cron notices.
    expect(effectivePlan({ plan: "trial", trialEndsAt: days(-1) }, NOW)).toBe("free");
    expect(effectivePlan({ plan: "trial", trialEndsAt: days(1) }, NOW)).toBe("trial");
  });

  it("treats a trial with no end date as free rather than as forever", () => {
    expect(effectivePlan({ plan: "trial", trialEndsAt: null }, NOW)).toBe("free");
    expect(effectivePlan({ plan: "trial", trialEndsAt: "not a date" }, NOW)).toBe("free");
  });

  it("defaults an unknown or missing plan to free, never to paid", () => {
    expect(effectivePlan(null, NOW)).toBe("free");
    expect(effectivePlan({ plan: "enterprise" }, NOW)).toBe("free");
    expect(effectivePlan({}, NOW)).toBe("free");
  });

  it("keeps beta whole — it is a gift received, not a bill arriving", () => {
    expect(effectivePlan({ plan: "beta" }, NOW)).toBe("beta");
    for (const f of PAID) expect(can("beta", f)).toBe(true);
  });
});

const PAID: Feature[] = [
  "shape.day", "shape.week", "sessions.long", "placement.calendar",
  "horizon.week", "history.patterns", "elections.strict", "ask.timing",
];

describe("what each plan carries", () => {
  it("gives paid and trial everything", () => {
    for (const plan of ["paid", "trial"] as Plan[]) {
      for (const f of PAID) expect(can(plan, f), `${plan} lost ${f}`).toBe(true);
    }
  });

  it("withholds exactly the orchestration features from free", () => {
    for (const f of PAID) expect(can("free", f), `free kept ${f}`).toBe(false);
  });
});

describe("the three amendments, which are the decision and not decoration", () => {
  it("never gates the Guiding Star count", () => {
    // The cap of 5 is an anti-overcommitment constraint — the UI says "Only 5
    // active at a time — pause one first". Converting an honest editorial
    // limit into a lever punishes people for using the product correctly.
    expect(NEVER_GATED).toContain("stars.count");
    expect(PAID).not.toContain("stars.count" as Feature);
  });

  it("never gates cadence forgiveness", () => {
    // The forgiving streak and "most days" are the differentiator nobody
    // notices until they fail. Charge for patterns over time; never for not
    // being shamed.
    expect(NEVER_GATED).toContain("cadence.forgiveness");
    expect(PAID).not.toContain("cadence.forgiveness" as Feature);
  });

  it("never gates the evidence behind a recommendation", () => {
    // A reason you must pay to see is not a reason. This is also why Ask's
    // "This moment" door — which explains a pick already on screen — is free
    // while only the timing door is paid.
    expect(NEVER_GATED).toContain("evidence");
    expect(can("free", "ask.timing")).toBe(false);
    expect(PAID).not.toContain("evidence" as Feature);
  });

  it("never gates export — data is not held hostage", () => {
    expect(NEVER_GATED).toContain("export");
  });

  it("keeps the never-gated list disjoint from the paid list", () => {
    // The guard against drift: a future feature key colliding with one of
    // these would silently paywall something the decision refused to.
    for (const k of NEVER_GATED) expect(PAID).not.toContain(k as unknown as Feature);
  });
});

describe("the trial", () => {
  it("runs 30 days, not 60", () => {
    // In a month a person meets four weekly reviews, four sprint suggestions
    // and one complete lunation; day 31-60 repeats those rather than adding.
    expect(TRIAL_DAYS).toBe(30);
  });

  it("reports whole days left, and never a negative", () => {
    expect(entitlementFor({ plan: "trial", trialEndsAt: days(30) }, NOW).trialDaysLeft).toBe(30);
    expect(entitlementFor({ plan: "trial", trialEndsAt: days(0.5) }, NOW).trialDaysLeft).toBe(1);
    const lapsed = entitlementFor({ plan: "trial", trialEndsAt: days(-5) }, NOW);
    expect(lapsed.plan).toBe("free");
    expect(lapsed.trialDaysLeft).toBe(null);
  });

  it("names no trial dates on a plan that is not a trial", () => {
    const paid = entitlementFor({ plan: "paid", trialEndsAt: days(10) }, NOW);
    expect(paid.trialEndsAt).toBe(null);
    expect(paid.trialDaysLeft).toBe(null);
  });
});

describe("the shape the client renders from", () => {
  it("answers every paid feature explicitly, so no key reads as undefined", () => {
    const e = entitlementFor({ plan: "free" }, NOW);
    for (const f of PAID) expect(typeof e.features[f], f).toBe("boolean");
  });
});
