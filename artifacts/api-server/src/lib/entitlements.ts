/**
 * WHAT AN ACCOUNT CAN DO — the one definition, server-side.
 *
 * The line is the one decided in artifacts/tides/DECISION-PRICING-2026-08-19:
 * FREE ANSWERS "NOW", PAID ANSWERS "WHEN", ACROSS A HORIZON. Free is
 * orientation — today's read, the loop, capture and check-off, the sky rail,
 * basic timing for today, Guiding Stars and habits as a plain planner, and
 * FULL INSPECTABLE EVIDENCE for every recommendation. Paid is orchestration:
 * horizons past today, Shape Day and Shape Week, long-session finding,
 * calendar-aware placement, history and patterns, and the timing half of Ask.
 *
 * It replaces a line the owner has since rejected. The client's lib/premium.ts
 * gated "currents / scheduling / practitioner" — paid meant natal
 * personalization — which the pricing decision turned down on the grounds
 * that the engine deliberately treats chartless as first-class ("chartless is
 * fine — GOOD tier only" appears at three call sites in linesUp). Pricing
 * there would have meant charging for the thing the architecture was built
 * to make optional.
 *
 * THIS FILE IS THE AUTHORITY AND THE CLIENT ASKS IT. The old gate was a
 * localStorage boolean that defaulted to UNLOCKED, which is a preference, not
 * an entitlement — anyone could flip it, and nothing server-side ever
 * checked. A paywall enforced only in the browser is decoration.
 */

export type Plan = "beta" | "free" | "trial" | "paid";

export type Feature =
  | "shape.day"          // Shape Day — the whole day placed at once
  | "shape.week"         // Shape Week
  | "sessions.long"      // finding long, uninterrupted stretches
  | "placement.calendar" // calendar-aware placement and re-homing
  | "horizon.week"       // reading past today
  | "history.patterns"   // what actually worked, over time
  | "elections.strict"   // the strict electional tools
  | "ask.timing"         // Ask's timing door, and multi-star Orient
  | "rhythm.astro";      // the chart's proposal for a working rhythm, and gear changes

/**
 * NEVER GATED, and the reasons are load-bearing rather than generous.
 *
 * These are recorded as data so the list cannot quietly drift: a future
 * feature key colliding with one of these is a bug, and the test says so.
 *
 *  - The GUIDING STAR CAP is an anti-overcommitment constraint. The UI says
 *    "Only 5 active at a time — pause one first". Turning an honest editorial
 *    limit into a lever would punish people for using the product correctly.
 *  - CADENCE FORGIVENESS — the forgiving streak, "most days", scoring against
 *    the rhythm someone chose — is the differentiator nobody notices until
 *    they fail. Charge for patterns over time; never for not being shamed.
 *  - EVIDENCE. Explaining a recommendation already on screen is what makes it
 *    trustworthy, and a reason you must pay to see is not a reason.
 *  - EXPORT. Data is never held hostage.
 */
export const NEVER_GATED = [
  "stars.count",
  "cadence.forgiveness",
  "evidence",
  "export",
] as const;

const PAID_ONLY: readonly Feature[] = [
  "shape.day", "shape.week", "sessions.long", "placement.calendar",
  "horizon.week", "history.patterns", "elections.strict", "ask.timing",
  "rhythm.astro",
];

export interface Entitlement {
  plan: Plan;
  /** When a trial ends, ISO. Null on every other plan. */
  trialEndsAt: string | null;
  /** Whole days remaining in a trial; null when not on one. Never negative. */
  trialDaysLeft: number | null;
  features: Record<Feature, boolean>;
}

/**
 * Resolve the plan a profile is ACTUALLY on right now.
 *
 * A trial whose end date has passed is a free account, whatever the column
 * says — the expiry has to be computed on read rather than waiting for a job
 * to run, or an account keeps paid features until some cron happens to notice.
 */
export function effectivePlan(
  row: { plan?: string | null; trialEndsAt?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): Plan {
  const raw = (row?.plan ?? "free") as Plan;
  if (raw !== "trial") return raw === "beta" || raw === "paid" || raw === "free" ? raw : "free";
  const ends = row?.trialEndsAt ? new Date(row.trialEndsAt) : null;
  if (!ends || Number.isNaN(ends.getTime())) return "free";
  return ends.getTime() > now.getTime() ? "trial" : "free";
}

/** Does this plan carry this feature? */
export function can(plan: Plan, feature: Feature): boolean {
  // `beta` is everyone, today: a gift received, not a bill arriving. It is
  // deliberately the same shape as `paid` rather than a special case scattered
  // through the guards, so the day it retires nothing else changes.
  if (plan === "beta" || plan === "paid" || plan === "trial") return true;
  return !PAID_ONLY.includes(feature);
}

export function entitlementFor(
  row: { plan?: string | null; trialEndsAt?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): Entitlement {
  const plan = effectivePlan(row, now);
  const ends = plan === "trial" && row?.trialEndsAt ? new Date(row.trialEndsAt) : null;
  const features = Object.fromEntries(
    PAID_ONLY.map(f => [f, can(plan, f)]),
  ) as Record<Feature, boolean>;
  return {
    plan,
    trialEndsAt: ends ? ends.toISOString() : null,
    trialDaysLeft: ends
      ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86_400_000))
      : null,
    features,
  };
}

/** Length of the trial, in days. 30 and not 60 — see the decision doc: in a
 *  month a person meets four weekly reviews, four sprint suggestions and one
 *  complete lunation, and day 31-60 repeats those categories rather than
 *  adding one. */
export const TRIAL_DAYS = 30;
