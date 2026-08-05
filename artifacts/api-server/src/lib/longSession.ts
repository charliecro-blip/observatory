/**
 * Long sessions — finding a 3–4 hour block, and describing its internal arc.
 *
 * Step 2 of the build order, on top of `dayTimeline`. The premise the whole
 * design turns on: **a long session is not a large moment.** The election
 * engine scores instants; a span needs interval reasoning, and neither obvious
 * reduction works. Averaging hides a hard contact in the middle and the person
 * walks into a wall at 2:40 with no warning; taking the peak lets one excellent
 * hour sell four mediocre ones.
 *
 * WHAT THIS RETURNS, AND WHY IT IS NOT ONE ANSWER
 * ---------------------------------------------------------------------------
 * Duration, exactitude and practical availability are genuinely different
 * things to want, and collapsing them into a single winner throws away the
 * information the person needs to choose. So: best uninterrupted, best
 * anchored, earliest workable — deduplicated, and often the same block appears
 * as more than one of them, which is itself worth seeing.
 *
 * RANKING IS LEXICOGRAPHIC, NEVER A BLENDED SCORE
 * ---------------------------------------------------------------------------
 * The design rejected average and peak; replacing them with a third weighted
 * sum would reintroduce the same failure one level up. Ordered comparison means
 * a strong Moon-sign affinity can never outweigh a calendar collision, and one
 * excellent hour can never erase a disruptive middle.
 *
 * THE ARC IS A MAP, NOT A NOTIFICATION SCHEDULE
 * ---------------------------------------------------------------------------
 * `arc` is rendered once, before the session. Turning each planetary hour into
 * an instruction would push someone to change cognitive mode every time the
 * ruler changes — including at the moment they finally reach flow. Astrology
 * driven interruption is a product failure, not a feature.
 */

import { dayTimeline, containers, type TimelineEvent, type Commitment } from "./dayTimeline.js";
import { activityByKey, modeOf } from "./activityCorrespondences.js";
import { evaluateActivityInterval } from "./electionEngine.js";
import { SIGNS, moonLongitude, julianDay, getPlanetaryHour, getSunriseSunset } from "./astro.js";

/** Classical antipathy: fire opposes water, air opposes earth. */
const ELEMENT_OF_SIGN = (sign: string): "fire" | "earth" | "air" | "water" =>
  (["fire", "earth", "air", "water"] as const)[SIGNS.indexOf(sign) % 4];
const ANTIPATHY: Record<string, string> = { fire: "water", water: "fire", air: "earth", earth: "air" };

export type BackgroundFit = "aligned" | "neutral" | "contrary";
export type Suitability = "clear" | "qualified" | "defer";
export type AnchorPlacement = "opening" | "middle" | "culminating";

export interface SessionArcChapter {
  ruler: string;
  startAt: Date;
  minutes: number;
  /** Where it sits in the session, for the map. */
  placement: AnchorPlacement;
  /** True when this ruler is one the activity actually wants. */
  preferred: boolean;
}

export interface SessionCandidate {
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  /** No hard boundary inside. False can still be a fine answer. */
  uninterrupted: boolean;
  backgroundFit: BackgroundFit;
  suitability: Suitability;
  /** Structured, so the UI never has to parse prose. */
  suitabilityReasons: string[];
  anchor?: { at: Date; label: string; placement: AnchorPlacement };
  preferredHourCoverage: { minutes: number; rulers: string[] };
  /** Qualifications and chapters that ride along inside. Never cuts. */
  transitions: TimelineEvent[];
  arc: SessionArcChapter[];
}

export interface LongSessionResult {
  requestedMinutes: number;
  /** Distinct tradeoffs, deduplicated. Empty when nothing fits. */
  options: { kind: "uninterrupted" | "anchored" | "earliest"; candidate: SessionCandidate }[];
  /**
   * When nothing of the requested length exists, what IS available — never a
   * silent fall back to the activity's minimum viable form. A four-hour
   * request must not quietly become "twenty minutes on the hardest part".
   */
  shortfall?: { longestMinutes: number; candidate: SessionCandidate | null };
}

const STEP_MIN = 15;

function placementOf(at: Date, startAt: Date, endAt: Date): AnchorPlacement {
  const span = endAt.getTime() - startAt.getTime();
  const p = (at.getTime() - startAt.getTime()) / span;
  return p < 1 / 3 ? "opening" : p > 2 / 3 ? "culminating" : "middle";
}

/**
 * The hours a session actually spans, computed from the local sequence rather
 * than inferred from duration.
 *
 * Planetary hours are TEMPORAL — daylight divided by twelve, night by twelve —
 * so their civil length changes with latitude and season and a four-hour block
 * does not contain four of them. At 60°N in winter a daylight hour is 28
 * minutes and a four-hour block spans eight, which is enough to repeat a ruler.
 * Assuming otherwise is the error this function exists to prevent.
 */
function arcOf(
  startAt: Date, endAt: Date, lat: number, lon: number, preferred: Set<string>,
): SessionArcChapter[] {
  const out: SessionArcChapter[] = [];
  let cursor = new Date(startAt);
  let guard = 0;
  while (cursor < endAt && guard++ < 24) {
    const h = getPlanetaryHour(cursor, lat, lon);
    if (!h?.endTime) break;
    const chapterEnd = h.endTime < endAt ? h.endTime : endAt;
    out.push({
      ruler: h.ruler,
      startAt: new Date(cursor),
      minutes: Math.max(1, Math.round((chapterEnd.getTime() - cursor.getTime()) / 60000)),
      placement: placementOf(cursor, startAt, endAt),
      preferred: preferred.has(h.ruler),
    });
    cursor = new Date(h.endTime.getTime() + 1000);
  }
  return out;
}

export interface FindLongSessionsOpts {
  activityKey: string;
  minutes: number;
  date: Date;
  lat: number;
  lon: number;
  wakeHour?: number;
  sleepHour?: number;
  commitments?: Commitment[];
  locationKnown?: boolean;
}

export function findLongSessions(opts: FindLongSessionsOpts): LongSessionResult | null {
  const { activityKey, minutes, date, lat, lon, commitments = [], locationKnown = true } = opts;
  const activity = activityByKey(activityKey);
  if (!activity) return null;

  const events = dayTimeline({ ...opts, commitments, locationKnown });
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const cs = containers(events, dayStart, dayEnd);

  // Background: the Moon's sign holds for ~2.5 days, so it cannot discriminate
  // between blocks WITHIN a day. It is a prior on the day, not a filter — a
  // hard veto could make a long session unavailable for days while the person
  // has the time today and a deadline tomorrow.

  // Planetary hours are fiction under polar day or night (see astro.ts): the
  // Sun never crosses the horizon, so there is no daylight span to divide.
  // Treated exactly like an unknown location — the arc is withheld rather than
  // captioned.
  const hoursReal = locationKnown && !getSunriseSunset(julianDay(date), lat, lon).polar;
  const preferred = new Set(activity.hourRulers ?? []);
  const isInception = modeOf(activityKey) === "inception";

  const candidates: SessionCandidate[] = [];
  let longestAvailable = 0;

  for (const c of cs) {
    longestAvailable = Math.max(longestAvailable, c.minutes);
    if (c.minutes < minutes) continue;
    const steps = Math.floor((c.minutes - minutes) / STEP_MIN);
    for (let i = 0; i <= steps; i++) {
      const startAt = new Date(c.startAt.getTime() + i * STEP_MIN * 60000);
      const endAt = new Date(startAt.getTime() + minutes * 60000);
      const inside = c.inside.filter(e => e.at >= startAt && e.at <= endAt);

      // Void policy comes from the ACTIVITY, not from a blanket rule, and is
      // scaled by mode. `voc: "avoid"` on an inception is a real deferral;
      // the same flag on execution work is a qualification at most. An
      // activity marked `favor` is one the void actively suits.
      // THE VERDICT IS INHERITED, NOT DERIVED.
      //
      // This module used to compute its own suitability from the activity's voc
      // policy, mode and Moon-sign fit, and disagreed with the election engine
      // on 20% of activity-days — engine `clear`, session finder `qualified`,
      // for the same afternoon. One interval and one activity get one verdict,
      // and it is made in electionEngine.
      //
      // What is added here is strictly INTERVAL-SPECIFIC and strictly one-way:
      // a void opening inside the block can make the verdict stricter, never
      // looser. Everything else — stations, retrograde caps, Mercury policy,
      // Moon sign as a prior — arrives already judged.
      const assessment = evaluateActivityInterval({ activityKey, startAt, endAt })!;
      const backgroundFit = assessment.backgroundFit;
      const reasons: string[] = assessment.suitabilityReasons.map(r =>
        `${r.kind.replace(/-/g, " ")}${(r as { planet?: string }).planet ? ` (${(r as { planet?: string }).planet})` : ""}`);

      const voidInside = inside.some(e => e.kind === "void-begins" || e.kind === "void-ends");
      const opensVoid = inside.some(e => e.kind === "void-begins");
      if (opensVoid && activity.voc === "avoid") {
        reasons.push(isInception ? "the Moon goes void inside this block" : "the Moon goes void partway through");
      }
      if (voidInside && activity.voc === "favor") reasons.push("the void suits this");

      // BACKGROUND FIT DOES NOT DECIDE SUITABILITY.
      //
      // `backgroundFit === "contrary"` used to push a reason here, which then
      // made the whole block "qualified". The election engine has no such rule
      // — Moon sign is a background PRIOR in this design, deliberately not a
      // veto, because a hard filter on a placement that lasts two and a half
      // days makes an activity unschedulable for days at a time.
      //
      // Measured before removing it: for the same activity on the same day the
      // engine said `clear` and this module said `qualified` on 25 of 125
      // comparisons — 20%. A user asking about deep work on 7 August got
      // "clear" from Home and "qualified" from the session finder. Two answers
      // to one question is a trust problem before it is a duplication problem.
      //
      // It survives as a RANKING signal (see the lexicographic sort) and as
      // descriptive metadata on the candidate. It no longer changes the verdict.
      // Strictest of (inherited, interval-specific). Never better than what the
      // engine said — a higher layer may narrow a verdict, never widen it.
      const RANKING: Record<Suitability, number> = { clear: 0, qualified: 1, defer: 2 };
      const intervalVerdict: Suitability =
        opensVoid && activity.voc === "avoid" && isInception ? "defer"
        : opensVoid && activity.voc === "avoid" ? "qualified"
        : "clear";
      const suitability: Suitability =
        RANKING[intervalVerdict] > RANKING[assessment.suitability] ? intervalVerdict : assessment.suitability;

      const arc = hoursReal ? arcOf(startAt, endAt, lat, lon, preferred) : [];
      const covered = arc.filter(a => a.preferred);
      const anchorEvent = inside.find(e => e.role === "anchor" &&
        preferred.has(String(e.detail?.planet ?? "")) )
        ?? inside.find(e => e.role === "anchor");

      candidates.push({
        startAt, endAt, durationMinutes: minutes,
        uninterrupted: true,                 // it came from inside one container
        backgroundFit, suitability, suitabilityReasons: reasons,
        anchor: anchorEvent ? {
          at: anchorEvent.at, label: anchorEvent.label,
          placement: placementOf(anchorEvent.at, startAt, endAt),
        } : undefined,
        preferredHourCoverage: {
          minutes: covered.reduce((n, a) => n + a.minutes, 0),
          rulers: [...new Set(covered.map(a => a.ruler))],
        },
        transitions: inside,
        arc,
      });
    }
  }

  if (!candidates.length) {
    const longest = cs.sort((a, b) => b.minutes - a.minutes)[0] ?? null;
    // The shortfall candidate gets a REAL verdict too. It used to be hardcoded
    // `suitability: "clear"` with no reasons — an invented judgment one layer
    // below the one that just got fixed, and the shortfall is exactly where
    // someone is most likely to act on a block anyway.
    const shortAssessment = longest
      ? evaluateActivityInterval({ activityKey, startAt: longest.startAt, endAt: longest.endAt })
      : null;
    return {
      requestedMinutes: minutes,
      options: [],
      shortfall: {
        longestMinutes: longestAvailable,
        candidate: longest && shortAssessment ? {
          startAt: longest.startAt, endAt: longest.endAt, durationMinutes: longest.minutes,
          uninterrupted: true,
          backgroundFit: shortAssessment.backgroundFit,
          suitability: shortAssessment.suitability,
          suitabilityReasons: shortAssessment.suitabilityReasons.map(r => r.kind.replace(/-/g, " ")),
          preferredHourCoverage: { minutes: 0, rulers: [] },
          transitions: longest.inside,
          arc: hoursReal ? arcOf(longest.startAt, longest.endAt, lat, lon, preferred) : [],
        } : null,
      },
    };
  }

  const SUIT_RANK: Record<Suitability, number> = { clear: 0, qualified: 1, defer: 2 };
  const FIT_RANK: Record<BackgroundFit, number> = { aligned: 0, neutral: 1, contrary: 2 };

  // Lexicographic. Each comparison only runs when everything above it ties, so
  // no amount of hour coverage can outrank a deferral.
  const byQuality = [...candidates].sort((a, b) =>
    SUIT_RANK[a.suitability] - SUIT_RANK[b.suitability] ||
    Number(b.uninterrupted) - Number(a.uninterrupted) ||
    b.preferredHourCoverage.minutes - a.preferredHourCoverage.minutes ||
    FIT_RANK[a.backgroundFit] - FIT_RANK[b.backgroundFit] ||
    a.startAt.getTime() - b.startAt.getTime());

  const anchored = [...candidates]
    .filter(c => c.anchor && c.suitability !== "defer")
    .sort((a, b) =>
      // An anchor is most useful where the activity wants it. Without a
      // per-activity placement policy yet, mid-session is the safe default:
      // exactitude at an edge is the case most likely to be wrong.
      (a.anchor!.placement === "middle" ? 0 : 1) - (b.anchor!.placement === "middle" ? 0 : 1) ||
      SUIT_RANK[a.suitability] - SUIT_RANK[b.suitability] ||
      a.startAt.getTime() - b.startAt.getTime())[0];

  const earliest = [...candidates]
    .filter(c => c.suitability !== "defer")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];

  const options: LongSessionResult["options"] = [];
  const seen = new Set<number>();
  const add = (kind: "uninterrupted" | "anchored" | "earliest", c?: SessionCandidate) => {
    if (!c) return;
    const k = c.startAt.getTime();
    if (seen.has(k)) return;      // the same block winning twice is one option
    seen.add(k);
    options.push({ kind, candidate: c });
  };
  add("uninterrupted", byQuality[0]);
  add("anchored", anchored);
  add("earliest", earliest);

  return { requestedMinutes: minutes, options };
}
