/**
 * Week-scale transit spans — the fast sky's short seasons.
 *
 * The owner's brief (2026-08-18): transits from Mercury, Venus, the Sun, Mars
 * and Jupiter to other planets "help define shorter periods of time", and
 * sprints — small time-bound pushes — can ride them. This module finds those
 * windows: for each pair where the FASTER body is one of the five, the run of
 * consecutive days it holds a major aspect within SPAN_ORB.
 *
 * WHY NOT getMajorAspects IN A LOOP. That function walks the real ephemeris
 * per aspect to catch stations — exactly right for "what is exact now", and
 * exactly the 90-second-calendar defect if called 24 times. A span needs only
 * one position set per day; everything else is arithmetic on longitudes.
 *
 * WHY A TIGHTER ORB THAN THE RAIL'S. At the rail's 8° a Sun aspect is "in
 * orb" for over two weeks and a Mars–Jupiter trine for a month — those are
 * seasons, not sprints. 3.5° keeps a Sun span near a week and lets the slow
 * pairs filter themselves out by duration. The rail's orbs are untouched;
 * this is a different question, not a seventh vocabulary.
 *
 * The Moon is excluded by construction (hours-scale, not week-scale), and a
 * span longer than MAX_DAYS is dropped rather than offered — a "sprint" the
 * length of a season would be the app inventing a commitment.
 */

import { getPlanetPositions, julianDay, ASPECT_DEFS } from "./astro.js";

/** Faster body first — a transit belongs to the one doing the moving. */
const SPEED_ORDER = ["Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const TRANSITING = new Set(["Sun", "Mercury", "Venus", "Mars", "Jupiter"]);

const SPAN_ORB = 3.5;
const MIN_DAYS = 3;
const MAX_DAYS = 21;
/** Days scanned behind/ahead of the anchor. Behind, so a span already underway
 *  shows its real start; ahead, three weeks of horizon. */
const SCAN_BACK = 10;
const SCAN_AHEAD = 21;

export interface TransitSpan {
  /** Stable identity for dedupe and dismissal: pair + aspect + peak date. */
  key: string;
  transitPlanet: string;
  aspect: string;              // conjunction | sextile | square | trine | opposition
  nature: string;              // the rail's own nature word for this aspect
  targetPlanet: string;
  startDate: string;           // viewer-civil YYYY-MM-DD, first in-orb day (may precede today)
  peakDate: string;            // day of closest approach within the scan
  endDate: string;             // last in-orb day, inclusive
  days: number;
  /** Today sits inside the window. */
  active: boolean;
  /** The scan's edge cut this span off; endDate is a floor, not a fact. */
  clipped: boolean;
  /** A short conditions phrase for the pair — never a promise. */
  theme: string;
}

// What kind of push the moving planet lends, and what the touched planet puts
// in the air. Conditions vocabulary only — the sentence a surface builds from
// these must describe the spell, never promise its outcome.
const PUSH: Record<string, string> = {
  Sun: "a showing-up push",
  Mercury: "a writing or outreach push",
  Venus: "a connection or beauty push",
  Mars: "a training or courage push",
  Jupiter: "a widening push",
};

/**
 * The ASPECT's own contribution — the mode of the push.
 *
 * Without this the theme was two independent lookups concatenated, so a
 * trine and a square produced identical copy (owner, 2026-08-19, on a
 * Venus–Saturn opposition: "make sure they're appropriate"). The shape of
 * an aspect is most of what it means — an opposition to Saturn is a
 * reckoning with what you have built, not a beauty push — so the mode
 * leads the sentence and the domain follows it.
 *
 * Conditions vocabulary only: each of these describes the spell, never an
 * outcome. The final wording is Astrolyrica's (see the brief in
 * ASTROLYRICA-COPY-HANDOFF.md); these are the working drafts.
 */
const MODE: Record<string, string> = {
  conjunction: "a good stretch to begin something",
  sextile: "an easy opening, if you want it",
  square: "friction worth using",
  trine: "a stretch that should run smoothly",
  opposition: "a stretch that asks for the other side of something",
};
const DOMAIN: Record<string, string> = {
  Sun: "visibility",
  Mercury: "words and errands",
  Venus: "taste and company",
  Mars: "nerve",
  Jupiter: "growth",
  Saturn: "structure",
  Uranus: "habit-breaking",
  Neptune: "quiet and imagination",
  Pluto: "the deep drawer",
};

function themeFor(transitPlanet: string, aspect: string, targetPlanet: string): string {
  const mode = MODE[aspect];
  const push = PUSH[transitPlanet] ?? "a short push";
  const domain = DOMAIN[targetPlanet];
  // mode → push → domain, in that order: the shape of the aspect, the kind
  // of effort it lends, and the territory it touches.
  const tail = domain ? `${push}, with ${domain} in the air` : push;
  return mode ? `${mode} — ${tail}` : tail;
}

/** The viewer's civil date for a day offset from the anchor. */
function civilDate(anchorMs: number, tzOffsetMin: number, dayOffset: number): string {
  return new Date(anchorMs - tzOffsetMin * 60000 + dayOffset * 86400000).toISOString().slice(0, 10);
}

/**
 * All week-scale spans around `now`, sorted active-first then by start.
 *
 * `now` is injectable for the same reason linesUp's is: tests must anchor to
 * a fixed sky, or they inherit the weather of whatever day they run on.
 */
export function transitSpans(opts: { tzOffsetMin: number; now?: Date }): TransitSpan[] {
  const { tzOffsetMin } = opts;
  const now = opts.now ?? new Date();
  const anchorMs = now.getTime();
  const today = civilDate(anchorMs, tzOffsetMin, 0);

  // One position set per scanned day, sampled at the viewer's civil noon.
  const days: { date: string; seps: Map<string, { sep: number; def: (typeof ASPECT_DEFS)[number] }> }[] = [];
  for (let d = -SCAN_BACK; d <= SCAN_AHEAD; d++) {
    const date = civilDate(anchorMs, tzOffsetMin, d);
    const sampleMs = Date.parse(`${date}T12:00:00Z`) + tzOffsetMin * 60000;
    const positions = getPlanetPositions(julianDay(new Date(sampleMs)));
    const byName = new Map(positions.map(p => [p.planet, p.longitude]));
    const seps = new Map<string, { sep: number; def: (typeof ASPECT_DEFS)[number] }>();
    for (let i = 0; i < SPEED_ORDER.length; i++) {
      if (!TRANSITING.has(SPEED_ORDER[i])) continue;
      for (let j = i + 1; j < SPEED_ORDER.length; j++) {
        const a = byName.get(SPEED_ORDER[i]);
        const b = byName.get(SPEED_ORDER[j]);
        if (a == null || b == null) continue;
        const raw = Math.abs(a - b) % 360;
        const angle = raw > 180 ? 360 - raw : raw;
        for (const def of ASPECT_DEFS) {
          const sep = Math.abs(angle - def.angle);
          if (sep <= SPAN_ORB) {
            seps.set(`${SPEED_ORDER[i]}|${SPEED_ORDER[j]}|${def.name}`, { sep, def });
          }
        }
      }
    }
    days.push({ date, seps });
  }

  // Group consecutive in-orb days per pair+aspect into spans.
  const spans: TransitSpan[] = [];
  const open = new Map<string, { start: number; peakIdx: number; peakSep: number }>();
  const close = (pairKey: string, endIdx: number) => {
    const run = open.get(pairKey);
    if (!run) return;
    open.delete(pairKey);
    const [t, target, aspect] = pairKey.split("|");
    const startClipped = run.start === 0;
    const endClipped = endIdx === days.length - 1;
    const length = endIdx - run.start + 1;
    // A clipped-at-the-far-edge span is kept (it is real and beginning);
    // one that outgrows MAX_DAYS inside the scan is a season, not a sprint.
    if (length < MIN_DAYS && !endClipped) return;
    if (length > MAX_DAYS) return;
    const def = ASPECT_DEFS.find(x => x.name === aspect)!;
    const startDate = days[run.start].date;
    const endDate = days[endIdx].date;
    if (endDate < today) return;   // already over — history, not an offer
    spans.push({
      key: `${t.toLowerCase()}-${aspect}-${target.toLowerCase()}-${days[run.peakIdx].date}`,
      transitPlanet: t, aspect, nature: def.nature, targetPlanet: target,
      startDate, peakDate: days[run.peakIdx].date, endDate,
      days: length,
      active: startDate <= today && today <= endDate,
      clipped: startClipped || endClipped,
      theme: themeFor(t, aspect, target),
    });
  };
  for (let idx = 0; idx < days.length; idx++) {
    const seen = new Set<string>();
    for (const [pairKey, { sep }] of days[idx].seps) {
      seen.add(pairKey);
      const run = open.get(pairKey);
      if (!run) open.set(pairKey, { start: idx, peakIdx: idx, peakSep: sep });
      else if (sep < run.peakSep) { run.peakSep = sep; run.peakIdx = idx; }
    }
    for (const pairKey of [...open.keys()]) {
      if (!seen.has(pairKey)) close(pairKey, idx - 1);
    }
  }
  for (const pairKey of [...open.keys()]) close(pairKey, days.length - 1);

  spans.sort((a, b) =>
    Number(b.active) - Number(a.active) || a.startDate.localeCompare(b.startDate) || a.days - b.days);
  return spans;
}
