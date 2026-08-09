/**
 * Shaping a week — where the scarce resource is attention, not windows.
 *
 * Step 6. A week is not seven days weaved independently. At day scale the
 * binding constraint is free time; at week scale it is how much demanding work
 * a person can actually sustain, and a weaver that optimises each day in
 * isolation will happily schedule five consecutive four-hour deep-work blocks
 * because each day, considered alone, had room.
 *
 * So this assigns items to DAYS first — under attention and recovery
 * constraints — and only then asks dayWeaver to place them. The day weaver
 * stays the single placement authority; nothing here re-derives timing.
 *
 * A GOOD WEEK CAN BE MOSTLY EMPTY
 * ---------------------------------------------------------------------------
 * "One major placement and several mostly open days" is a correct answer, and
 * `lightDays` exists so the UI can render those as deliberate rather than as
 * days the scheduler failed to fill. Occupancy is never the target.
 *
 * AND THE SKY STILL DOES NOT CHOOSE THE WORK
 * ---------------------------------------------------------------------------
 * Never suggest a Venus activity because Thursday has a Venus window. Thursday
 * is suggested only when something the person already holds benefits from it —
 * the day assignment below is driven by deadlines, demand and recovery, and the
 * sky only picks the hour once the day is settled.
 */

import { weaveDay, type WeaveItem, type WovenDay, type Placement } from "./dayWeaver.js";
import type { Commitment } from "./dayTimeline.js";
import { dayKeyIn, dayBoundsIn } from "./localClock.js";
import { activityByKey, rankActivities } from "./activityCorrespondences.js";

/** What a piece of work costs in attention, independent of the clock. */
export type Demand = "major" | "moderate" | "light";

/**
 * One major piece of work per day.
 *
 * Not an astrological limit and not a productivity opinion dressed as one: two
 * four-hour blocks in a day is eight hours of the hardest work a person does,
 * and a scheduler that permits it is the reason "optimised" calendars get
 * abandoned. The ceiling is what makes the rest of the week honest.
 */
const MAX_MAJOR_PER_DAY = 1;
/** After a major day, the next day carries a reduced ceiling. */
const RECOVERY_LOAD = 0.4;
const NORMAL_LOAD = 0.6;

export interface WeekItem extends WeaveItem {
  /** Which Guiding Star this serves, so one Star cannot eat a whole day. */
  starId?: string | null;
}

export interface WeekDay {
  date: Date;
  /** YYYY-MM-DD, local. */
  key: string;
  woven: WovenDay;
  /** True when this day was deliberately kept light, not merely empty. */
  light: boolean;
  /** Set when the previous day carried a major piece of work. */
  recovering: boolean;
}

export interface WovenWeek {
  days: WeekDay[];
  /** Items no day could take, with a reason. Never silently dropped. */
  unplaced: { item: WeekItem; reason: string }[];
  warnings: string[];
}

export interface WeaveWeekOpts {
  items: WeekItem[];
  /** First day. Seven days from here. */
  startDate: Date;
  lat: number;
  lon: number;
  wakeHour?: number;
  sleepHour?: number;
  /** Keyed by YYYY-MM-DD. */
  commitmentsByDay?: Record<string, Commitment[]>;
  locationKnown?: boolean;
  days?: number;
  /** The viewer's zone; decides where each of the seven days begins. */
  tzOffsetMin?: number;
}

// Day keys are the user's calendar dates — `dayKeyIn`, not local getters.

function resolveActivity(item: WeekItem): string | null {
  if (item.activityKey && activityByKey(item.activityKey)) return item.activityKey;
  const r = rankActivities(item.title, 1)[0];
  return r && r.score >= 2.0 ? r.activity.key : null;
}

/**
 * Attention cost. Derived from duration where one is known, because that is the
 * only honest signal available — an unestimated item cannot be assumed heavy or
 * light, so it is treated as moderate and the day weaver will refuse it later
 * if it has no basis for a duration at all.
 */
export function demandOf(item: WeekItem): Demand {
  const mins = item.estMinutes ?? 0;
  if (mins >= 120) return "major";
  if (mins >= 45) return "moderate";
  if (mins > 0) return "light";
  return "moderate";
}

export function weaveWeek(opts: WeaveWeekOpts): WovenWeek {
  const {
    items, startDate, lat, lon, wakeHour = 7, sleepHour = 23,
    commitmentsByDay = {}, locationKnown = true, days = 7, tzOffsetMin = 0,
  } = opts;

  // Each date is NOON IN THE USER'S ZONE, derived from their midnight rather
  // than set with server-local `setHours` — otherwise the whole week is
  // anchored a few hours off and its first day can be the wrong day.
  const [day0Start] = dayBoundsIn(startDate, tzOffsetMin);
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(new Date(day0Start.getTime() + i * 86400000 + 12 * 3600000));
  }
  const keys = dates.map(d => dayKeyIn(d, tzOffsetMin));

  // ── Assign items to days. Deadlines bind; demand and recovery shape.
  const assigned: Record<string, WeekItem[]> = Object.fromEntries(keys.map(k => [k, []]));
  const majorOn: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  // Seeded with the minutes ALREADY committed on each day, not zero.
  //
  // Counting only assigned items made "least loaded" mean "fewest things I have
  // put here", so a Thursday carrying an eight-hour offsite looked emptier than
  // a free Wednesday holding one 30-minute task — and the week duly handed
  // Thursday the four-hour deep-work block. The quantity being minimised has to
  // be the day's real occupancy.
  const loadOn: Record<string, number> = Object.fromEntries(keys.map(k => [
    k,
    (commitmentsByDay[k] ?? []).reduce(
      (n, c) => n + Math.max(0, (c.endAt.getTime() - c.startAt.getTime()) / 60000), 0),
  ]));
  const starOn: Record<string, Set<string>> = Object.fromEntries(keys.map(k => [k, new Set<string>()]));
  const unplaced: WovenWeek["unplaced"] = [];

  // Most-constrained first: an item due Tuesday has fewer options than an
  // undated one, so letting the undated item claim Tuesday first would strand it.
  const ordered = [...items].sort((a, b) => {
    const ad = a.dueDate ?? "9999-99-99";
    const bd = b.dueDate ?? "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return demandOf(b) === "major" ? 1 : -1;
  });

  for (const item of ordered) {
    const demand = demandOf(item);

    // OVERDUE IS URGENT, NOT IMPOSSIBLE.
    //
    // A deadline filter of `k <= dueDate` drops every item whose date has
    // already passed, because no day in the week satisfies it. On real data
    // that was catastrophic and silent: five of eight items — including every
    // task the person was actually late on — came back "due 2026-08-01, which
    // is before this week starts", and the week rendered as seven empty days.
    // The day weaver had this right all along (overdue sits at priority 1);
    // only the week treated a past deadline as a wall rather than a debt.
    //
    // Every fixture in the tests used FUTURE dates, which is why the suite was
    // green while the feature was useless.
    const overdue = !!item.dueDate && item.dueDate < keys[0];
    const eligible = overdue ? keys : keys.filter(k => !item.dueDate || k <= item.dueDate);
    if (!eligible.length) {
      unplaced.push({ item, reason: `due ${item.dueDate}, and there is no day left before then` });
      continue;
    }

    const star = item.starId ?? null;
    const viable = eligible.filter(k => {
      if (demand === "major" && majorOn[k] >= MAX_MAJOR_PER_DAY) return false;
      // One Star must not eat a whole day — a week that spends Tuesday entirely
      // on one aim is not a distributed week.
      if (star && starOn[k].has(star)) return false;
      return true;
    });
    // LEAST LOADED, not earliest.
    //
    // `find` took the first viable day, which front-loads the whole week: on
    // real input it put four items and 365 minutes on Wednesday and left
    // Saturday through Tuesday completely empty. Distribution is the one job a
    // week weaver has that a day weaver cannot do, and first-fit is precisely
    // the strategy that cannot do it.
    //
    // Deadlines still bind, because `eligible` is already capped at the due
    // date — spreading can only move work earlier within that window, never
    // past it.
    // Overdue work goes EARLIEST, not wherever there is most room — spreading
    // it would be scheduling a debt at leisure.
    const target = [...viable].sort((a, b) =>
      overdue
        ? keys.indexOf(a) - keys.indexOf(b)
        : (loadOn[a] - loadOn[b] || keys.indexOf(a) - keys.indexOf(b)))[0];

    if (!target) {
      unplaced.push({
        item,
        reason: demand === "major"
          ? "every day before its deadline already carries a major piece of work"
          : "no day before its deadline had room left",
      });
      continue;
    }

    assigned[target].push(item);
    loadOn[target] += item.estMinutes ?? 45;
    if (demand === "major") majorOn[target]++;
    if (star) starOn[target].add(star);
  }

  // ── Weave each day, with the ceiling reduced after a demanding one.
  const out: WeekDay[] = [];
  let previousWasMajor = false;

  for (let i = 0; i < dates.length; i++) {
    const key = keys[i];
    const recovering = previousWasMajor;
    const woven = weaveDay({
      items: assigned[key],
      date: dates[i],
      lat, lon, wakeHour, sleepHour, tzOffsetMin,
      commitments: commitmentsByDay[key] ?? [],
      locationKnown,
      maxLoadFraction: recovering ? RECOVERY_LOAD : NORMAL_LOAD,
    });

    // Anything the day could not take is reported at week level too, so a
    // caller reading only the week does not lose it.
    for (const u of woven.unplaced) {
      // "the day is already 13% booked" reads as nonsense unless the reader
      // knows the day was under a reduced ceiling because yesterday was heavy.
      const why = recovering && /already \d+% booked/.test(u.reason)
        ? `${u.reason} (this day is recovering from a heavy one, so it carries a lower ceiling)`
        : u.reason;
      unplaced.push({ item: u.item as WeekItem, reason: `${key}: ${why}` });
    }

    out.push({
      date: dates[i],
      key,
      woven,
      light: woven.placed.length === 0,
      recovering,
    });
    previousWasMajor = woven.placed.some((p: Placement) => p.minutes >= 120);
  }

  const warnings: string[] = [];
  const lightCount = out.filter(d => d.light).length;
  if (lightCount && items.length) {
    // Said plainly so the UI never renders empty days as a failure to fill.
    warnings.push(`${lightCount} ${lightCount === 1 ? "day is" : "days are"} deliberately open. Nothing you hold needed placing there.`);
  }
  const majorDays = keys.filter(k => majorOn[k] > 0).length;
  if (majorDays > 4) {
    warnings.push(`${majorDays} of ${days} days carry a major piece of work. That is a heavy week.`);
  }
  // Unresolvable activities are the day weaver's business, but the week should
  // say once that they exist rather than repeating it seven times.
  const noBasis = items.filter(i => !resolveActivity(i) && !i.estMinutes).length;
  if (noBasis) {
    warnings.push(`${noBasis} ${noBasis === 1 ? "item has" : "items have"} no duration and no recognisable kind of work — add a rough estimate to schedule them.`);
  }

  return { days: out, unplaced, warnings };
}
