/**
 * THE RHYTHM A HABIT DECLARES, IN ONE PLACE.
 *
 * habits.ts, elections.ts and sprints.ts each ask the same three questions —
 * what does this cadence want this week, is today's copy of it satisfied, how
 * many times a day does it ask for — and until this file existed each route
 * answered them with its own inline arithmetic. Adding `several` (owner
 * 2026-08-31) meant editing three copies of the same logic, which is exactly
 * how they drift: sprints.ts's copy fell through to the `occasional` branch
 * and silently made every `several` habit un-sprintable until it was caught.
 *
 * Routes import the database at module load, so logic kept in a route file
 * cannot be unit-tested without provisioning Postgres — the same reason
 * habitTiming.ts exists apart from habits.ts. This is that pattern, extended.
 */

export const CADENCES = ["daily", "most_days", "weekly", "several", "occasional"] as const;
export type Cadence = (typeof CADENCES)[number];

export const normalizeCadence = (v: unknown): Cadence =>
  (CADENCES as readonly string[]).includes(v as string) ? (v as Cadence) : "daily";

/** How many times a `several` habit wants doing each day. Never zero — a
 *  target of zero is not "several", it is "never", and would divide by zero
 *  in the progress math below. */
export function targetPerDayFor(targetPerDay: number | null | undefined): number {
  return Math.max(1, targetPerDay ?? 2);
}

/**
 * The rolling-window target this cadence is judged against.
 *
 *   daily      7  — every day
 *   most_days  5  — ~5 of 7, forgiving by design
 *   weekly     targetPerWeek — a person-chosen quota
 *   several    targetPerDay × 7 — TICKS in a week, not days touched; a
 *              habit asking for three a day asks for twenty-one a week
 *   occasional 0  — no target, so it can never be behind
 */
export function windowTargetFor(
  cadence: Cadence,
  targetPerWeek: number | null | undefined,
  targetPerDay: number | null | undefined,
): number {
  if (cadence === "daily") return 7;
  if (cadence === "most_days") return 5;
  if (cadence === "weekly") return Math.min(7, Math.max(1, targetPerWeek ?? 3));
  if (cadence === "several") return targetPerDayFor(targetPerDay) * 7;
  return 0; // occasional
}

/**
 * Is a day's tally enough to count as kept, for this cadence?
 *
 * For every cadence but `several`, one log is the whole answer — the habit
 * happened or it did not. For `several`, one log is progress, not
 * completion: a habit asking for three ticks is not kept on the first.
 */
export function dayMet(cadence: Cadence, count: number, targetPerDay: number | null | undefined): boolean {
  if (cadence === "several") return count >= targetPerDayFor(targetPerDay);
  return count > 0;
}

// ── Solar anchors ────────────────────────────────────────────────────────
// A habit can hang on more than one landmark of the day (owner 2026-08-31:
// "check the garden" at sunrise AND sunset is one habit with two real
// moments). Stored the way every other list on the habits table already is
// — favoredElements, favoredPhases, favoredPlanets are all CSV in one text
// column — so this extends the table's existing idiom rather than inventing
// a new one; the column needed no migration.
export const SOLAR_ANCHORS = ["sunrise", "noon", "sunset", "bed"] as const;
export type SolarAnchor = (typeof SOLAR_ANCHORS)[number];

export function normalizeSolarAnchors(v: unknown): string | null {
  const raw = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
  const clean = [...new Set(raw.filter((x): x is SolarAnchor => (SOLAR_ANCHORS as readonly string[]).includes(x as string)))];
  return clean.length ? clean.join(",") : null;
}
