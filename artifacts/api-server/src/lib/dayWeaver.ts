/**
 * Shaping a day — placing what the person actually holds into the time they
 * actually have.
 *
 * Step 5. Deliberately NOT called "fill my day". "Full but holistic" contains a
 * dangerous optimisation target: a scheduler asked to produce a full day will
 * produce one, and the result reads as authority while being slot-stuffing.
 * This one is asked to *shape* a day, and a mostly-open day is a correct
 * answer.
 *
 * THE TWO RULES THAT KEEP THIS FROM BECOMING A HOROSCOPE GENERATOR
 * ---------------------------------------------------------------------------
 * 1. Only ever place what the person HOLDS. Tasks, Guiding Star steps, habits
 *    with a real cadence. If there is a good Venus window at 4pm and nothing in
 *    their life wants one, the honest output is an empty 4pm — never "connect
 *    with a loved one".
 *
 * 2. Astrology chooses only AMONG VIABLE PLACEMENTS. It never decides how much
 *    work someone ought to have. The priority order below is entirely
 *    practical; the sky breaks ties within it.
 *
 * GAPS AND REFUSALS ARE OUTPUT, NOT FAILURE
 * ---------------------------------------------------------------------------
 * `openTime` and `unplaced` are first-class parts of the result. A day with
 * three placements and a lot of white space is a real plan, and "two of your
 * tasks had no uninterrupted block before their deadline" is information the
 * person needs. Silently dropping them would be the same defect as a
 * product-ranking limit standing in for a scientific conclusion.
 */

import { dayTimeline, containers, type Commitment } from "./dayTimeline.js";
import { dayKeyIn, dayBoundsIn, dayKeyInZone, dayBoundsInZone } from "./localClock.js";
import { findLongSessions } from "./longSession.js";
import { rankActivities, activityByKey } from "./activityCorrespondences.js";

/**
 * Fallback durations by window type, in minutes.
 *
 * PRODUCT DEFAULTS, NOT DOCTRINE. Nothing in the tradition says deep work takes
 * ninety minutes. They exist because `tasks.est_minutes` is nullable and most
 * rows have no estimate, and a scheduler that refused to place anything
 * unestimated would be useless on real data. Every placement that used one is
 * flagged `assumedDuration`, so the UI can say so rather than implying the
 * person specified it.
 */
const WINDOW_MINUTES: Record<string, number> = {
  deep_work: 90, creative: 90, study: 60, planning: 45,
  admin: 30, social: 90, relationship: 90, recovery: 45,
  launch: 60, retreat: 120,
};
const DEFAULT_MINUTES = 45;

export interface WeaveItem {
  id: string;
  title: string;
  kind: "task" | "star-step" | "habit";
  /** From tasks.est_minutes when set. Null means we will assume one. */
  estMinutes?: number | null;
  /** YYYY-MM-DD. Drives priority, and whether an unplaced item is urgent. */
  dueDate?: string | null;
  /** Already begun — protected before anything else gets placed. */
  startedAt?: string | null;
  /** An activity already assigned; used rather than re-derived. */
  activityKey?: string | null;
  /** low | medium | high — what the person said it takes. Read by the plain
   *  weave to hand high-energy work the early stretches; the sky path keeps
   *  using elections for this. */
  energy?: string | null;
  /**
   * The clock this item has usually been placed at — "HH:MM" in the viewer's
   * zone, derived by the caller from the person's own past windows. Read
   * only when the weave is asked to protect routines (the Route rhythm).
   */
  usualStart?: string | null;
}

export interface Placement {
  item: WeaveItem;
  startAt: Date;
  endAt: Date;
  minutes: number;
  /** True when the duration came from WINDOW_MINUTES, not from the person. */
  assumedDuration: boolean;
  activityKey: string | null;
  /** Why here — from the session finder, the person's own usual slot, or
   *  "the only time that fits". */
  basis: "elected" | "first-fit" | "usual";
  /** Under Route: the elected slot that was available and NOT taken, so the
   *  person can see what keeping the routine cost. Output, never silent. */
  keptOver?: { startAt: Date; endAt: Date } | null;
}

export interface Unplaced {
  item: WeaveItem;
  /** Plain, specific, and never a euphemism for "we gave up". */
  reason: string;
}

export interface OpenStretch { startAt: Date; endAt: Date; minutes: number }

export interface WovenDay {
  placed: Placement[];
  unplaced: Unplaced[];
  openTime: OpenStretch[];
  warnings: string[];
}

export interface WeaveOpts {
  items: WeaveItem[];
  date: Date;
  lat: number;
  lon: number;
  wakeHour?: number;
  sleepHour?: number;
  commitments?: Commitment[];
  locationKnown?: boolean;
  /** The viewer's zone (getTimezoneOffset semantics). Decides what "today"
   *  and the day's bounds mean; 0 = UTC, the old prod behaviour. */
  tzOffsetMin?: number;
  /** The viewer's IANA zone. Optional — without it, `tzOffsetMin` is used as
   *  a snapshot (wrong by up to an hour on a DST-transition day). With it,
   *  "today" and the day's bounds are recomputed for the correct offset on
   *  the specific day in question. */
  timeZone?: string;
  /**
   * How much of the waking day may be committed to placed work. A scheduler
   * with no ceiling will happily book every waking minute, which is the
   * occupancy target this design refuses. Not an astrological limit — an
   * ergonomic one.
   */
  maxLoadFraction?: number;
  /**
   * The astro-quiet lens's seam (home-base build 2026-08-16). Default true —
   * the sky chooses among viable placements, as ever. False skips the
   * election consult entirely: placement runs on deadline pressure, stated
   * energy, busy blocks and first-fit alone. ONE weaver, two modes — a
   * second weaver would drift, which is the WeekStrip/AlreadyWoven bug shape.
   */
  consultSky?: boolean;
  /**
   * THE ROUTE RHYTHM'S ONE RULE (DESIGN-WORKING-RHYTHM-2026-08-21 §4): an
   * item with a usual slot keeps it when it fits and the sky does not object,
   * even when a better-scored window is open elsewhere. The astrology yields
   * to continuity; what it yielded is reported on the placement.
   */
  protectRoutine?: boolean;
}

const MIN_USEFUL_GAP = 20;

/** Practical priority. The sky never reorders this; it only breaks ties inside it. */
function priorityOf(item: WeaveItem, today: string): number {
  if (item.startedAt) return 0;                                   // already begun
  if (item.dueDate && item.dueDate < today) return 1;             // overdue
  if (item.dueDate === today) return 2;                           // due today
  if (item.kind === "habit") return 3;                            // cadence-bound
  if (item.kind === "star-step") return 4;
  return 5;
}

/**
 * How long to reserve — or null when we genuinely do not know.
 *
 * Returning a default for an item we could neither estimate nor classify was
 * fabrication with consequences: "Renew the domain" is a two-minute chore and
 * it was being given a 45-minute block, which is the slot-stuffing this design
 * exists to refuse. A default is only honest when it derives from something
 * real — here, the window type of an activity we actually recognised.
 *
 * Null sends the item to `unplaced` with an actionable reason, which also makes
 * `est_minutes` worth filling in.
 */
function durationOf(item: WeaveItem, activityKey: string | null): { minutes: number; assumed: boolean } | null {
  if (item.estMinutes && item.estMinutes > 0) return { minutes: item.estMinutes, assumed: false };
  if (!activityKey) return null;
  const wt = activityByKey(activityKey)?.windowType;
  return { minutes: (wt && WINDOW_MINUTES[wt]) || DEFAULT_MINUTES, assumed: true };
}

function resolveActivity(item: WeaveItem): string | null {
  if (item.activityKey && activityByKey(item.activityKey)) return item.activityKey;
  const ranked = rankActivities(item.title, 2);
  // Same bar the Home module uses: a weak match is not a classification, and
  // scheduling something as the wrong activity is worse than scheduling it
  // without astrological preference at all.
  return ranked[0] && ranked[0].score >= 2.0 ? ranked[0].activity.key : null;
}

export function weaveDay(opts: WeaveOpts): WovenDay {
  const {
    items, date, lat, lon, wakeHour = 7, sleepHour = 23,
    commitments = [], locationKnown = true, maxLoadFraction = 0.6,
    tzOffsetMin = 0, timeZone, consultSky = true, protectRoutine = false,
  } = opts;

  // In the USER'S zone, not the server's. Built from local getters, this was
  // UTC in production — so from ~7 PM Austin time, "today" was tomorrow and
  // everything due today was judged overdue. The module that decides what is
  // overdue was the one place the day boundary was wrong.
  //
  // Zone-aware when available: `tzOffsetMin` alone is a snapshot, wrong by up
  // to an hour on the day a clock changes.
  const today = timeZone ? dayKeyInZone(date, timeZone) : dayKeyIn(date, tzOffsetMin);
  const [dayStart, dayEnd] = timeZone ? dayBoundsInZone(date, timeZone) : dayBoundsIn(date, tzOffsetMin);

  const events = dayTimeline({ date, lat, lon, wakeHour, sleepHour, commitments, locationKnown, tzOffsetMin, timeZone });
  // Free stretches start as the containers between hard boundaries and get
  // carved as placements land.
  // A placement that ends at the exact minute sleep begins is ergonomically
  // wrong however good the sky is — the weaver was putting a four-hour deep
  // work block at 19:00-23:00 against a 23:00 bedtime. Reserve a wind-down at
  // the end of the last waking stretch. Practical, not astrological.
  const WIND_DOWN_MIN = 30;
  let free: OpenStretch[] = containers(events, dayStart, dayEnd)
    .map(c => ({ startAt: c.startAt, endAt: c.endAt, minutes: c.minutes }));
  const last = free[free.length - 1];
  if (last && last.minutes > WIND_DOWN_MIN) {
    last.endAt = new Date(last.endAt.getTime() - WIND_DOWN_MIN * 60000);
    last.minutes -= WIND_DOWN_MIN;
  }

  const wakingMinutes = free.reduce((n, f) => n + f.minutes, 0);
  const loadCeiling = Math.floor(wakingMinutes * maxLoadFraction);

  const placed: Placement[] = [];
  const unplaced: Unplaced[] = [];
  const warnings: string[] = [];
  let committed = 0;

  // Practical priority first, always. The plain weave adds two tie-breakers
  // inside a priority class — nearest deadline, then stated energy (high
  // first, so demanding work claims the early stretches first-fit hands out
  // in clock order from the person's own wake hour). The sky path keeps its
  // original stable order: elections already choose the hour there, and
  // reordering its input would change shipped behaviour for no gain.
  const ENERGY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ordered = [...items].sort((a, b) => {
    const p = priorityOf(a, today) - priorityOf(b, today);
    if (p !== 0 || consultSky) return p;
    const dueA = a.dueDate ?? "9999-12-31", dueB = b.dueDate ?? "9999-12-31";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return (ENERGY_RANK[a.energy ?? ""] ?? 1) - (ENERGY_RANK[b.energy ?? ""] ?? 1);
  });

  for (const item of ordered) {
    const activityKey = resolveActivity(item);
    const dur = durationOf(item, activityKey);
    if (!dur) {
      unplaced.push({
        item,
        reason: "no estimate, and the title does not clearly name a kind of work — add a rough duration to schedule it",
      });
      continue;
    }
    const { minutes, assumed } = dur;

    if (committed + minutes > loadCeiling) {
      unplaced.push({
        item,
        reason: `the day is already ${Math.round((committed / wakingMinutes) * 100)}% booked — this would push it past what a day holds`,
      });
      continue;
    }

    // Astrology first, but only to CHOOSE among slots that already fit. When it
    // has no opinion, or its answer is already taken, first-fit still places
    // the item — a practical placement beats no placement. At the quiet lens
    // (`consultSky: false`) this block is skipped whole: the ONLY sky consult
    // in the weaver, which is what makes one weaver serve both lenses.
    let slot: { startAt: Date; endAt: Date } | null = null;
    let basis: Placement["basis"] = "first-fit";
    let keptOver: Placement["keptOver"] = null;

    const sessions = activityKey && consultSky
      ? findLongSessions({ activityKey, minutes, date, lat, lon, wakeHour, sleepHour, commitments, locationKnown })
      : null;
    const elected = (sessions?.options ?? [])
      .map(o => o.candidate)
      .find(c => c.suitability !== "defer" && fitsInFree(free, c.startAt, c.endAt)) ?? null;

    // The usual slot first, under Route. It is taken when it fits the free
    // stretches and no deferred session overlaps it; the elected slot it
    // displaces is kept on the placement so the trade is visible.
    if (protectRoutine && item.usualStart) {
      const [hh, mm] = item.usualStart.split(":").map(Number);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const uStart = new Date(dayStart.getTime() + (hh * 60 + mm) * 60000);
        const uEnd = new Date(uStart.getTime() + minutes * 60000);
        const deferredOverlap = (sessions?.options ?? []).some(o =>
          o.candidate.suitability === "defer" && o.candidate.startAt < uEnd && o.candidate.endAt > uStart);
        if (!deferredOverlap && fitsInFree(free, uStart, uEnd)) {
          slot = { startAt: uStart, endAt: uEnd };
          basis = "usual";
          const sameSlot = elected && Math.abs(elected.startAt.getTime() - uStart.getTime()) < 30 * 60000;
          keptOver = elected && !sameSlot ? { startAt: elected.startAt, endAt: elected.endAt } : null;
        }
      }
    }

    if (!slot && elected) { slot = { startAt: elected.startAt, endAt: elected.endAt }; basis = "elected"; }

    if (!slot) slot = firstFit(free, minutes);

    if (!slot) {
      unplaced.push({
        item,
        reason: item.dueDate && item.dueDate <= today
          ? `no free stretch of ${minutes} minutes left today, and it is due`
          : `no free stretch of ${minutes} minutes left today`,
      });
      continue;
    }

    placed.push({ item, startAt: slot.startAt, endAt: slot.endAt, minutes, assumedDuration: assumed, activityKey, basis, keptOver });
    committed += minutes;
    free = carve(free, slot.startAt, slot.endAt);
  }

  // Slivers are not usable time and reporting them as "open" overstates the
  // day. They stay out of openTime but their minutes are already spent.
  const openTime: OpenStretch[] = free.filter(f => f.minutes >= MIN_USEFUL_GAP);

  if (!placed.length && items.length) {
    warnings.push("Nothing could be placed today. The day is either full or the items need durations.");
  }
  const overdueUnplaced = unplaced.filter(u => u.item.dueDate && u.item.dueDate < today).length;
  if (overdueUnplaced) {
    warnings.push(`${overdueUnplaced} overdue ${overdueUnplaced === 1 ? "item" : "items"} could not be placed today.`);
  }

  // Chronological, not priority order. Priority decides WHAT gets placed and in
  // what order it claims time; the result is a day, and a day is read forwards.
  placed.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  openTime.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return { placed, unplaced, openTime, warnings };
}

function fitsInFree(free: OpenStretch[], startAt: Date, endAt: Date): boolean {
  return free.some(f => startAt >= f.startAt && endAt <= f.endAt);
}

function firstFit(free: OpenStretch[], minutes: number): { startAt: Date; endAt: Date } | null {
  for (const f of [...free].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    if (f.minutes >= minutes) {
      return { startAt: new Date(f.startAt), endAt: new Date(f.startAt.getTime() + minutes * 60000) };
    }
  }
  return null;
}

/** Remove [startAt, endAt) from the free list, keeping whatever remains either side. */
function carve(free: OpenStretch[], startAt: Date, endAt: Date): OpenStretch[] {
  const out: OpenStretch[] = [];
  for (const f of free) {
    if (endAt <= f.startAt || startAt >= f.endAt) { out.push(f); continue; }
    if (startAt > f.startAt) {
      out.push({ startAt: f.startAt, endAt: startAt, minutes: Math.round((startAt.getTime() - f.startAt.getTime()) / 60000) });
    }
    if (endAt < f.endAt) {
      out.push({ startAt: endAt, endAt: f.endAt, minutes: Math.round((f.endAt.getTime() - endAt.getTime()) / 60000) });
    }
  }
  return out.filter(f => f.minutes > 0);
}
