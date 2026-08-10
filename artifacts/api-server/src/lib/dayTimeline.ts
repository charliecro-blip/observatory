/**
 * The canonical ordered timeline of a day, with each event's ROLE.
 *
 * Step 1 of the long-session build order. Everything downstream — the session
 * candidate generator, the day weaver, the week weaver — reads this instead of
 * re-deriving events from the ephemeris, so there is one answer to "what
 * happens today and what does each thing do to a block of work".
 *
 * THE ROLE IS THE POINT.
 * ---------------------------------------------------------------------------
 * Rev 1 of the design treated every lunar event as a wall: cut the day at each
 * void, ingress and perfection, then score the fragments. GPT's critique was
 * right that this imports INCEPTIONAL judgment into ongoing work. `MODE_BY_KEY`
 * already classifies `deep-work` as `execution`, and the app's settled position
 * is that a void is thin for *starting* something meant to last and perfectly
 * fine for finishing and refining. A rule that shattered a four-hour editing
 * block because the Moon went void at 3:15 would contradict the app's own
 * doctrine module.
 *
 * So events are TYPED rather than uniformly destructive:
 *
 *   hard-boundary   ends a block. Practical, not astrological: a meeting, the
 *                   edge of the waking day, the end of the horizon.
 *   qualification   changes what the block is SUITED to, scaled by activity
 *                   mode. A void qualifies an inception and barely touches
 *                   maintenance.
 *   anchor          has a clock time worth building around — a perfection.
 *   chapter         internal texture: an hour change, a sign ingress.
 *
 * Only `hard-boundary` cuts. The rest ride along inside a block and are handed
 * to the narrator.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * No scoring, no ranking, no activity awareness. It reports what happens. The
 * moment it starts deciding which events are *good* it becomes a second timing
 * authority, which is the defect already tracked against the Planner (P0.8).
 */

import {
  julianDay, getSunriseSunset, getPlanetaryHour, voidOfCourse,
  moonFinalAspectInSign, moonLongitude, SIGNS, getMoonContacts,
} from "./astro.js";
import { dayBoundsIn, dayBoundsInZone } from "./localClock.js";
import { wakingSegments } from "./waking.js";

/**
 * Only two roles, and only one of them is a judgment.
 *
 * `hard-boundary` is PRACTICAL — a meeting, the edge of the waking day. It is
 * the same fact for every activity, so this module can and must decide it.
 *
 * `sky-event` is everything astrological, and it deliberately carries NO
 * interpretation. What a void or an ingress MEANS is activity-relative: a void
 * is a serious objection to an inception, a useful shift for finishing, and
 * close to irrelevant to an already-running deep-work session. This file used
 * to stamp `qualification`, `anchor` and `chapter` universally, which is the
 * same mistake that made longSession and the election engine disagree on 20%
 * of activity-days — a judgment made where the activity is not known.
 *
 * `skyEventRole(kind, activityKey)` in electionEngine assigns the real role.
 */
export type EventRole = "hard-boundary" | "sky-event";

export type EventKind =
  | "waking-start" | "waking-end"
  | "commitment-start" | "commitment-end"
  | "void-begins" | "void-ends"
  | "moon-ingress"
  | "hour-change"
  | "moon-perfects"
  | "horizon-end";

export interface TimelineEvent {
  at: Date;
  kind: EventKind;
  role: EventRole;
  /** Short, literal, no counsel. Narration happens downstream. */
  label: string;
  /** Kind-specific facts, so downstream never re-derives them. */
  detail?: Record<string, string | number | boolean>;
}

export interface Commitment { startAt: Date; endAt: Date; title?: string }

export interface DayTimelineOpts {
  date: Date;
  lat: number;
  lon: number;
  /**
   * The viewer's zone (getTimezoneOffset semantics). Day boundaries and
   * waking edges are computed in it; 0 means UTC, which is also what the old
   * server-local code silently meant in production.
   */
  tzOffsetMin?: number;
  /** The viewer's IANA zone. Optional; when present, day bounds recompute
   *  the correct offset for THIS day rather than trusting the `tzOffsetMin`
   *  snapshot, which is wrong by up to an hour on a DST-transition day. */
  timeZone?: string;
  /** Local waking hours, 0–24. Defaults are the app's ordinary chronotype. */
  wakeHour?: number;
  sleepHour?: number;
  /** Calendar events. The only truly non-negotiable boundaries here. */
  commitments?: Commitment[];
  /**
   * Planetary hours come from local sunrise and sunset, so on a guessed
   * meridian every boundary is fiction. When false, hour-change events are
   * omitted entirely rather than emitted and captioned — the app's standing
   * rule is that a disclaimer means the design is wrong.
   */
  locationKnown?: boolean;
}

const ROLE_OF: Record<EventKind, EventRole> = {
  "waking-start": "hard-boundary",
  "waking-end": "hard-boundary",
  "commitment-start": "hard-boundary",
  "commitment-end": "hard-boundary",
  "horizon-end": "hard-boundary",
  // Facts, not judgments. See EventRole.
  "void-begins": "sky-event",
  "void-ends": "sky-event",
  "moon-ingress": "sky-event",
  "hour-change": "sky-event",
  "moon-perfects": "sky-event",
};

const jdToDate = (jd: number) => new Date((jd - 2440587.5) * 86400000);
const signOf = (lon: number) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];

// Day bounds come from `dayBoundsIn` — the user's midnight, not the
// server's. The old local helper here was UTC midnight in production.

/**
 * When the Moon next changes sign, found by stepping and watching the sign
 * actually change rather than by dividing degrees remaining by a mean speed.
 * Her speed varies by roughly 11–15°/day, so the mean-speed estimate is wrong
 * by up to an hour — enough to put an ingress on the wrong side of a block
 * boundary.
 */
function nextIngress(fromJd: number, limitJd: number): { at: Date; from: string; to: string } | null {
  const startSign = signOf(moonLongitude(fromJd));
  const STEP = 1 / 96;                       // 15 min
  let prev = fromJd;
  for (let t = fromJd + STEP; t <= limitJd; t += STEP) {
    if (signOf(moonLongitude(t)) !== startSign) {
      // Bisect to the minute so the reported time is worth printing.
      let lo = prev, hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (signOf(moonLongitude(mid)) === startSign) lo = mid; else hi = mid;
      }
      return { at: jdToDate(hi), from: startSign, to: signOf(moonLongitude(hi)) };
    }
    prev = t;
  }
  return null;
}

export function dayTimeline(opts: DayTimelineOpts): TimelineEvent[] {
  const { date, lat, lon, wakeHour = 7, sleepHour = 23, commitments = [], locationKnown = true, tzOffsetMin = 0, timeZone,
  } = opts;
  const [dayStart, dayEnd] = timeZone ? dayBoundsInZone(date, timeZone) : dayBoundsIn(date, tzOffsetMin);
  const events: TimelineEvent[] = [];

  const push = (at: Date, kind: EventKind, label: string, detail?: TimelineEvent["detail"]) => {
    if (at < dayStart || at > dayEnd) return;      // outside the day is not this day's news
    events.push({ at, kind, role: ROLE_OF[kind], label, detail });
  };

  // ── Waking edges. Overnight chronotypes give two segments, which is why
  //    this uses the shared helper rather than assuming wake < sleep.
  for (const [lo, hi] of wakingSegments(wakeHour, sleepHour)) {
    // Offsets from the USER'S midnight. `setHours` here would set the
    // server's local hour on an instant that is no longer server-midnight.
    const a = new Date(dayStart.getTime() + lo * 3600000);
    const b = new Date(dayStart.getTime() + hi * 3600000);
    if (lo > 0) push(a, "waking-start", "awake");
    if (hi < 24) push(b, "waking-end", "asleep");
  }

  // ── Commitments. The only boundaries that are genuinely non-negotiable.
  for (const c of commitments) {
    push(c.startAt, "commitment-start", c.title ? `${c.title} starts` : "commitment starts",
      c.title ? { title: c.title } : undefined);
    push(c.endAt, "commitment-end", c.title ? `${c.title} ends` : "commitment ends");
  }

  // ── The void. Its START is the Moon's last perfected aspect in this sign;
  //    it ENDS at the ingress. Both are qualifications, not cuts.
  const jdStart = julianDay(dayStart);
  const jdEnd = julianDay(dayEnd);
  const ingress = nextIngress(jdStart, jdEnd + 2);

  const finalAspect = moonFinalAspectInSign(jdStart);
  if (finalAspect) {
    const at = jdToDate(finalAspect.atJd);
    // The perfection itself is an ANCHOR — it has a clock time worth building
    // around. The void it opens is a separate, later-typed event.
    push(at, "void-begins", `Moon ${finalAspect.aspect} ${finalAspect.planet}, then void`, {
      aspect: finalAspect.aspect, planet: finalAspect.planet,
    });
  } else if (voidOfCourse(jdStart).voc) {
    // Already void when the day began: report the state without inventing a
    // start time inside today that did not happen today.
    push(dayStart, "void-begins", "void when the day began", { alreadyVoid: true });
  }

  if (ingress) {
    push(ingress.at, "void-ends", `void ends — Moon enters ${ingress.to}`, { sign: ingress.to });
    push(ingress.at, "moon-ingress", `Moon ${ingress.from} → ${ingress.to}`, {
      from: ingress.from, to: ingress.to,
    });
  }

  // ── Lunar perfections. Every classical planet the Moon contacts today.
  //
  // Without these the `anchor` role was declared and never emitted — a variant
  // that could not occur, which is the same defect as a flag that never turns
  // on. Downstream cannot place a session around an exactitude the timeline
  // never reports.
  for (const planet of ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
    for (const c of getMoonContacts(planet, jdStart, jdEnd)) {
      push(new Date(c.at), "moon-perfects", `Moon ${c.aspect} ${planet}`, {
        planet, aspect: c.aspect, nature: c.nature, hard: c.hard,
      });
    }
  }

  // ── Planetary hour changes. Withheld entirely on a guessed meridian: every
  //    boundary would be fiction, and captioning fiction is not a fix.
  //
  //    Withheld for the same reason under POLAR day or night: above the polar
  //    circles the Sun may not rise or set, and getSunriseSunset substitutes a
  //    symmetric twelve-hour day so its callers always get a Date. Dividing
  //    that substitute into twelve gives twelve fictional hours. Unknown
  //    location and polar night are different causes of the same problem.
  const sun = getSunriseSunset(jdStart, lat, lon);
  if (locationKnown && !sun.polar) {
    if (sun?.sunrise && sun?.sunset) {
      let cursor = new Date(dayStart);
      let guard = 0;
      while (cursor < dayEnd && guard++ < 40) {
        const h = getPlanetaryHour(cursor, lat, lon);
        if (!h?.endTime) break;
        if (h.endTime > dayStart && h.endTime < dayEnd) {
          const next = getPlanetaryHour(new Date(h.endTime.getTime() + 60_000), lat, lon);
          push(h.endTime, "hour-change", `${next?.ruler ?? "?"} hour begins`, {
            ruler: next?.ruler ?? "", previous: h.ruler,
          });
        }
        cursor = new Date(h.endTime.getTime() + 60_000);
      }
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return events;
}

/**
 * The intact containers of a day: the stretches between HARD boundaries only.
 *
 * This is the segmentation rev 1 got wrong. Qualifications, anchors and
 * chapters ride along inside a container and are reported with it; they do not
 * split it. A four-hour block that happens to contain a sign ingress is still
 * a four-hour block.
 */
export interface Container { startAt: Date; endAt: Date; minutes: number; inside: TimelineEvent[] }

export function containers(events: TimelineEvent[], dayStart: Date, dayEnd: Date): Container[] {
  const hard = events.filter(e => e.role === "hard-boundary").sort((a, b) => a.at.getTime() - b.at.getTime());

  // Awake/asleep and commitments interleave, so walk the day tracking whether
  // we are currently inside an open container rather than pairing events up.
  const out: Container[] = [];
  let open: Date | null = null;
  let busy = 0;

  for (const e of hard) {
    if (e.kind === "waking-start") { if (!busy) open = e.at; }
    else if (e.kind === "waking-end") { if (open) { out.push({ startAt: open, endAt: e.at, minutes: 0, inside: [] }); open = null; } }
    else if (e.kind === "commitment-start") {
      if (open && !busy) { out.push({ startAt: open, endAt: e.at, minutes: 0, inside: [] }); open = null; }
      busy++;
    } else if (e.kind === "commitment-end") {
      busy = Math.max(0, busy - 1);
      if (!busy) open = e.at;
    }
  }
  if (open && open < dayEnd) out.push({ startAt: open, endAt: dayEnd, minutes: 0, inside: [] });

  return out
    .filter(c => c.endAt > c.startAt)
    .map(c => ({
      ...c,
      minutes: Math.round((c.endAt.getTime() - c.startAt.getTime()) / 60000),
      inside: events.filter(e => e.role !== "hard-boundary" && e.at >= c.startAt && e.at <= c.endAt),
    }));
}
