/**
 * How a habit sits against the sky right now.
 *
 * Habits absorbed the old "practices/cultivations" timing model (2026-07-09
 * merge), so ONE daily-doing surface carries both the streak game and the
 * timing intelligence.
 *
 * IN A LIB RATHER THAN IN THE ROUTE, since 2026-08-14. This was inside
 * routes/habits.ts, which imports the database at module load — so the scoring
 * could not be tested without provisioning Postgres, and it therefore was not
 * tested at all. Pure judgment about the sky has no business behind a DB
 * import; the route keeps the queries and calls in here for the verdict.
 */
import { WINDOW_ELEMENT } from "./timingTier.js";

export const csv = (v: unknown): string[] =>
  String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function phaseQuadrant(name: string): string {
  if (name.includes("New")) return "new";
  if (name.includes("Waxing")) return "waxing";
  if (name.includes("Full")) return "full";
  return "waning";
}

export interface HabitTimingInput {
  favoredElements: string | null;
  favoredPhases: string | null;
  favoredPlanets?: string | null;
  bestWindowType?: string | null;
  minimumViable: string | null;
}

export interface SkySnapshot {
  element: string;
  hourRuler: string;
  phase: string;
  voc: boolean;
  moonApplyingTo: Set<string>;
  retro: Set<string>;
}

/**
 * The elements implied by a habit's chosen kinds of work.
 *
 * `WINDOW_ELEMENT` is imported rather than restated. A second copy of the
 * mapping here would be a seventh favorability vocabulary, which BACKLOG §7
 * parks deliberately, and the reasoning behind the table (why `deep_work`
 * reads as earth and not fire) is written down beside the original.
 */
export function elementsFromWindowTypes(bestWindowType: string | null | undefined): string[] {
  return [...new Set(csv(bestWindowType).map((w) => WINDOW_ELEMENT[w]).filter(Boolean))];
}

/**
 * KIND OF WORK COUNTS — as a WEAKER, DERIVED signal than a stated element.
 *
 * `bestWindowType` was collected by the habit form, stored, and read back into
 * the form, and nothing else ever looked at it. It sat in the creation sheet
 * under a "Timing" heading beside three fields that do drive timing (elements,
 * phases, planets), with nothing to distinguish it — so a person choosing
 * "deep work" reasonably believed they had told Compass when to want the
 * habit, and had told it nothing. Wired 2026-08-14.
 *
 * The two sources of an element stay separate on purpose. A habit that states
 * `earth` AND picks `deep_work` (which maps to earth) is making ONE claim by
 * two routes, and paying it twice would let a single fact carry a habit from
 * neutral to resonant on its own. So they are scored as a max rather than a
 * sum, and the derived route is worth less: an element you chose outright is
 * better evidence than one inferred from a category.
 */
export function scoreHabitTiming(
  h: HabitTimingInput,
  sky: SkySnapshot,
): { match: string; note: string } {
  const elems = csv(h.favoredElements);
  const phases = csv(h.favoredPhases);
  const favored = csv(h.favoredPlanets);
  const fromKind = elementsFromWindowTypes(h.bestWindowType);
  let score = 0;
  const why: string[] = [];
  if (elems.includes(sky.element)) {
    score += 3;
    why.push(`it's a ${sky.element} day`);
  } else if (fromKind.includes(sky.element)) {
    // Named as the kind of work rather than as the day, because that is what
    // the person actually chose — telling them "it's an earth day" when they
    // never mentioned earth would explain the verdict with a fact they have no
    // way to connect back to their own habit.
    score += 2;
    why.push(`this kind of work suits a ${sky.element} day`);
  }
  if (favored.includes(sky.hourRuler)) { score += 2; why.push(`${sky.hourRuler}'s hour is running`); }
  for (const fp of favored) {
    if (sky.moonApplyingTo.has(fp)) { score += 1; why.push(`the Moon is lighting up ${fp}`); }
    if (sky.retro.has(fp)) { score -= 1; }
  }
  if (phases.includes(sky.phase)) { score += 1; why.push(`the ${sky.phase} moon favors it`); }
  if (sky.voc) score -= 1;

  const match = score >= 5 ? "resonant" : score >= 2 ? "supported" : score >= 0 ? "neutral" : score >= -2 ? "soften" : "protect";
  const note =
    match === "resonant" ? `Strongly backed right now — ${why[0] ?? "the sky is with it"}.`
    : match === "supported" ? `Supported today${why[0] ? ` — ${why[0]}` : ""}.`
    : match === "neutral" ? "A neutral day for this — do it if you feel like it."
    : `Consider the minimum today${h.minimumViable ? `: ${h.minimumViable}` : ""}.`;
  return { match, note };
}
