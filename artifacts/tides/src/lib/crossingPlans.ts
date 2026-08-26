/**
 * SCHEDULING SOMETHING AGAINST A CROSSING.
 *
 * A planet crossing a local angle is the shortest-lived fact in Compass: the
 * angle sweeps about 14° an hour, so a 3° orb is roughly thirteen minutes
 * either side of exact — a window about twenty-six minutes wide.
 *
 * The Agenda showed those windows and then offered no way to do anything with
 * one ("i should be able to schedule things for crossings", owner
 * 2026-08-25). This turns a crossing row into a block you can save.
 *
 * WHY THE SUGGESTIONS ARE SMALL. AngleCrossing already has a per-planet
 * activity table, and it reaches for large things — "a hard workout", "the big
 * ask, teaching, or reaching wider". Those are right when the reader is
 * choosing what to spend a Mars window on and wrong as a prefilled event,
 * because twenty-six minutes does not hold a workout or a lesson. The owner
 * asked for the smaller register: "we might encourage scheduling small
 * activities (breaks, pace changes) for those." So this table stays inside
 * what actually fits — a walk, a call, a break, one dull job.
 *
 * The two tables describe the same seven planets in the same order and must
 * not drift into two voices about one sky, which is the mistake the void Moon
 * copy made once. AngleCrossing answers "what is this window for"; this
 * answers "what would you put in it right now".
 */

import { WINDOW_MIN } from "@/components/AngleCrossing";

export interface CrossingPlan {
  /** Goes in the event title field. Short enough to read in a day column. */
  title: string;
  /** One of Calendar's WINDOW_TYPES. */
  type: string;
  /** The suggestion line, shown under the crossing before you commit to it. */
  what: string;
}

const PLANS: Record<string, CrossingPlan> = {
  Moon:    { title: "Break",            type: "recovery",     what: "food, air, or ten minutes off the screen" },
  Mars:    { title: "Push",             type: "deep_work",    what: "a fast walk, or the one task you keep moving down the list" },
  Mercury: { title: "Clear the queue",  type: "admin",        what: "the messages and calls that have been sitting" },
  Venus:   { title: "Pause with someone", type: "relationship", what: "a coffee, a check-in, or tidying the desk you work at" },
  Jupiter: { title: "Ask",              type: "social",       what: "the request you have been rehearsing" },
  Saturn:  { title: "Maintenance",      type: "admin",        what: "the form, the filing, the job with no shine on it" },
  Sun:     { title: "Be seen",          type: "social",       what: "send the update, or say the thing in the room" },
};

/** Half the window, rounded to whole minutes. ≈13. */
export const HALF_WINDOW_MIN = Math.round(WINDOW_MIN);

/**
 * The plan for a crossing, or null when the planet has no entry.
 *
 * Null rather than a generic fallback: an outer planet has no small-activity
 * register that a twenty-six minute block would satisfy, and inventing one
 * would put words in the sky's mouth. A crossing with no plan still shows as
 * a moment — it simply is not offered as something to schedule.
 */
export function planForCrossing(planet: string): CrossingPlan | null {
  return PLANS[planet] ?? null;
}

/** "HH:MM" in local time, the format Calendar's time inputs take. */
function clockOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface CrossingBlock { title: string; type: string; startTime: string; endTime: string; notes: string; }

/**
 * A saveable block centered on the moment of exactness.
 *
 * Centered rather than started-at: a crossing is strongest at exact and the
 * approach counts as much as the separation, so a block that begins at exact
 * spends half its length after the window has closed.
 *
 * Returns null for a planet with no plan, or an unparseable instant, rather
 * than falling back to a time that would be a guess.
 */
export function blockForCrossing(planet: string, angle: string, atISO: string): CrossingBlock | null {
  const plan = planForCrossing(planet);
  if (!plan) return null;
  const t = Date.parse(atISO);
  if (Number.isNaN(t)) return null;

  const start = new Date(t - HALF_WINDOW_MIN * 60000);
  const end   = new Date(t + HALF_WINDOW_MIN * 60000);
  const exact = new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return {
    title: plan.title,
    type: plan.type,
    startTime: clockOf(start),
    endTime: clockOf(end),
    // One fact, one source: the time it happens and how wide it runs. No
    // claim about what the block will accomplish.
    notes: `${planet} crosses your ${angle} at ${exact}, about ${HALF_WINDOW_MIN * 2} minutes wide.`,
  };
}
