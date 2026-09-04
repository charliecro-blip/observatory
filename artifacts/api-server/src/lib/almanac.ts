import {
  julianDay, SIGNS, sunLongitude, moonLongitude, isRetrograde, eclipseWindow,
  getPlanetPositions, getNextAngularCrossings, isSignificantCrossing,
} from "./astro.js";
import { transitSpans, SCAN_AHEAD } from "./transitSpans.js";
import { HOUSE_THEME } from "./positionFix.js";

// ── The almanac: the sky's own calendar, independent of anyone's task list ───
//
// Plan asks "when should this go?" against YOUR inventory. The almanac answers
// the question underneath it — what the month itself is doing — so work can be
// placed around dates that are already fixed. Standing dates only: lunations,
// quarters, retrograde stations, solar ingresses. Nothing here is personal, so
// nothing here needs a chart.
//
// SAMPLING, deliberately: 6-hourly for the Moon (elongation moves ~0.5°/hour,
// so a 6h step cannot skip a 90° gate) and daily for the slow bodies, each
// refined by bisection. It does NOT call getMajorAspects — that runs a 14-day
// station sweep per call and has caused three separate performance defects in
// this codebase. See lib/astro.ts.
//
// `now` is a parameter, not a wall-clock read, so this is testable against a
// fixed moment instead of against whatever sky the suite happens to run under.

export type AlmanacEntry = {
  at: string;                                   // ISO instant; client formats in its own zone
  kind: "lunation" | "quarter" | "station" | "ingress" | "aspect" | "crossing";
  title: string;
  /** For an aspect row, the same fact in the app's own words. Absent on rows
   *  whose title is already plain (a Full Moon needs no second phrasing). */
  gloss?: string;
  note: string;
  glyph: string;
  eclipse?: "solar" | "lunar";
  /** Aspects only: the window, since a span is a stretch rather than an instant. */
  startDate?: string;
  endDate?: string;
  /** Aspects only: today sits inside the window. */
  active?: boolean;
  /**
   * WHICH HOUSE, when a natal chart is on file — the answer to "where is it"
   * (owner 2026-09-03: "it just says new moon — but where is it?"). Whole-sign:
   * purely the transiting sign against the Ascendant's, no cusp math needed.
   * Absent whenever no chart was given to buildAlmanac, same as every other
   * personal field in this app — an impersonal fact stays impersonal rather
   * than guessing a house nobody confirmed.
   */
  house?: number;
  houseTheme?: string;
};

/**
 * What the almanac can and cannot see.
 *
 * The fixed events are computed to the horizon asked for. The ASPECTS are not:
 * transitSpans scans a fixed 21 days ahead, so a 90-day almanac has aspect data
 * for the first three weeks and none after. Reported rather than implied,
 * because a list that simply stops looks like a quiet sky, and this codebase
 * has spent real time removing exactly that lie from other surfaces.
 */
export type AlmanacHorizon = { days: number; aspectsThrough: string };

/**
 * THE ASPECT SPANS, folded in where they belong.
 *
 * They were a separate call with a separate shape, and the Almanac view
 * stitched the two together client-side. That is one stitch away from the two
 * copy tables that drifted for weeks — the same facts, dated the same way,
 * assembled in a place that has to remember to do it. The sky's own calendar
 * is one list.
 *
 * transitSpans is impersonal (it takes a timezone and nothing else). The
 * personal layer — which star or habit a pair touches — stays where it was, on
 * /transits/spans, which is a sprint proposal rather than a calendar.
 */
function aspectEntries(now: Date, tzOffsetMin: number, endJd: number, jdToIso: (jd: number) => string): AlmanacEntry[] {
  const startJd = julianDay(now);
  return transitSpans({ tzOffsetMin, now })
    // transitSpans scans ten days BACK as well as forward, and the almanac is
    // what is ahead — its window contract, and its test, say every entry sits
    // inside [now, now+days]. A span that already peaked is winding down; one
    // still peaking ahead shows as "in force now" if today is inside it.
    .filter(sp => {
      const peak = julianDay(new Date(`${sp.peakDate}T12:00:00Z`));
      return peak >= startJd && peak <= endJd;
    })
    .map(sp => ({
      at: `${sp.peakDate}T12:00:00.000Z`,
      kind: "aspect" as const,
      glyph: "✦",
      // THE TRANSIT, THEN THE READING (owner, 2026-08-28: "i would rather
      // these planetary aspect lists start with the literal transit, then give
      // the interpretations").
      //
      // The title was the reading and only the reading — "Mars grinds against
      // Saturn" — so the one fact in the row, the aspect itself, appeared
      // nowhere. That inverts the house rule everywhere else in the app, where
      // the fact leads and what to make of it follows, and it left a reader
      // unable to check the claim against any other ephemeris.
      title: `${sp.transitPlanet} ${sp.aspect} ${sp.targetPlanet}`,
      /** The reading of that aspect, kept apart from the fact it reads. */
      gloss: `${sp.transitPlanet} ${ASPECT_WORD[sp.aspect] ?? "meets"} ${sp.targetPlanet}`,
      // The theme is a conditions phrase, never a promise — its own comment
      // says so, and it is the only sentence these rows carry.
      note: sp.theme,
      startDate: sp.startDate,
      endDate: sp.endDate,
      active: sp.active,
    }));
}

// "opposition" used to gloss to "opposes" — the same word with a different
// ending, so the row said the same thing twice (owner, 2026-09-03: "wtf?").
// Every other entry here actually translates the term; this one now does too.
const ASPECT_WORD: Record<string, string> = {
  conjunction: "meets", opposition: "pulls against", square: "grinds against",
  trine: "flows with", sextile: "supports",
};

/** Where the aspect half of the almanac stops seeing, as a civil date. */
export function almanacHorizon(now: Date, days: number): AlmanacHorizon {
  const through = new Date(now.getTime() + Math.min(days, SCAN_AHEAD) * 86400000);
  return { days, aspectsThrough: through.toISOString().slice(0, 10) };
}

/**
 * Angle crossings run per-day at a 24h lookahead, orb 40, then filtered to
 * planet-ASC/MC + Moon — the EXACT call `/tides/week` already makes across
 * up to 42 days without incident (routes/tides.ts:612). Reused rather than
 * `getNextAngularCrossings`'s fine-grained 4-minute default lookahead, which
 * is built for a same-day scan and would be the same "scan in a loop" defect
 * this repo has already paid for three times (see lib/astro.ts header).
 */
const CROSSING_HORIZON_DAYS = 14;

export function buildAlmanac(now: Date, days: number, tzOffsetMin = 0, personal?: {
  /** Whole-sign house context — the answer to "where is it" — needs only the
   *  Ascendant's sign, not the whole chart. */
  ascendantSign?: string;
  /** Present only when the caller has a real location (never the app's
   *  timezone-guess default), since a crossing is cut from local sunrise and
   *  local angles — a guessed meridian would draw crossings that are wrong. */
  lat?: number; lon?: number;
  /** Off by default: crossings run daily, so folding them in unconditionally
   *  would multiply this list by roughly one row a day (owner 2026-09-03:
   *  wants them available, not wants them always on). */
  includeCrossings?: boolean;
}): AlmanacEntry[] {
  const startJd = julianDay(now);
  const endJd = startJd + days;

  const entries: AlmanacEntry[] = [];
  const jdToIso = (jd: number) => new Date((jd - 2440587.5) * 86400000).toISOString();

  // Whole-sign: the house a transiting sign falls in is pure sign arithmetic
  // against the Ascendant's sign — no cusp degrees needed. Same convention
  // /elections/times already personalizes with (routes/elections.ts).
  const houseOf = (sign: string): Partial<Pick<AlmanacEntry, "house" | "houseTheme">> => {
    if (!personal?.ascendantSign) return {};
    const ascIdx = SIGNS.indexOf(personal.ascendantSign), signIdx = SIGNS.indexOf(sign);
    if (ascIdx < 0 || signIdx < 0) return {};
    const house = ((signIdx - ascIdx + 12) % 12) + 1;
    return { house, houseTheme: HOUSE_THEME[house] };
  };

  // Bisect a sign-changing predicate to ~1 minute.
  const refine = (lo: number, hi: number, crossed: (jd: number) => boolean): number => {
    for (let i = 0; i < 22 && hi - lo > 1 / 1440; i++) {
      const mid = (lo + hi) / 2;
      if (crossed(mid)) hi = mid; else lo = mid;
    }
    return hi;
  };

  // ── Lunations and quarters ──
  {
    const elong = (jd: number) => {
      const e = (moonLongitude(jd) - sunLongitude(jd)) % 360;
      return e < 0 ? e + 360 : e;
    };
    const GATES: Array<{ deg: number; kind: "lunation" | "quarter"; title: string; glyph: string; note: string }> = [
      { deg: 0,   kind: "lunation", title: "New Moon",      glyph: "●",
        note: "A cycle starts here, which makes it the month's most natural place to begin something you mean to build on." },
      { deg: 90,  kind: "quarter",  title: "First quarter", glyph: "◐",
        note: "This is the cycle's first friction, where a plan meets what carrying it takes." },
      { deg: 180, kind: "lunation", title: "Full Moon",     glyph: "○",
        note: "Whatever has been building is at its most visible, which suits finishing, reviewing, and letting go more than starting." },
      { deg: 270, kind: "quarter",  title: "Last quarter",  glyph: "◑",
        note: "The cycle turns toward clearing away what is finished." },
    ];
    const STEP = 0.25; // 6 hours
    let prev = elong(startJd);
    for (let jd = startJd + STEP; jd <= endJd; jd += STEP) {
      const cur = elong(jd);
      for (const g of GATES) {
        // The 0° gate is the 360→0 wrap; the rest are ordinary upward crossings.
        const hit = g.deg === 0 ? cur < prev : (prev < g.deg && cur >= g.deg);
        if (!hit) continue;
        const at = refine(jd - STEP, jd, (m) =>
          g.deg === 0 ? elong(m) < prev : elong(m) >= g.deg);
        const ecl = g.kind === "lunation" ? eclipseWindow(at) : { active: false as const };
        // The Moon's own sign at the gate — "where" a lunation or quarter
        // falls for this person, the same question a New Moon in the abstract
        // can't answer on its own.
        const moonSign = SIGNS[Math.floor((((moonLongitude(at) % 360) + 360) % 360) / 30)];
        entries.push({
          at: jdToIso(at), kind: g.kind, glyph: g.glyph,
          title: ecl.active
            ? (ecl.kind === "solar" ? "Solar eclipse" : "Lunar eclipse")
            : g.title,
          // Names the phase it falls on, because "Solar eclipse" alone drops the
          // fact that this is also the new moon someone may be planning around.
          note: ecl.active
            ? `An eclipse falls on this ${ecl.kind === "solar" ? "new moon" : "full moon"}, which Compass weights as the month's turning point.`
            : g.note,
          ...(ecl.active && ecl.kind ? { eclipse: ecl.kind } : {}),
          ...houseOf(moonSign),
        });
      }
      prev = cur;
    }
  }

  // ── Retrograde stations ──
  //
  // The single most planning-relevant thing an almanac carries: the dates a
  // planet's testimony changes character for weeks at a stretch.
  {
    const STATION_NOTES: Record<string, { retro: string; direct: string; glyph: string }> = {
      Mercury: { glyph: "☿",
        retro:  "Compass reads the weeks ahead as favoring revision over launch, and gives contracts and announcements a second pass before they go out.",
        direct: "The revision pressure eases from here, though Mercury spends the following weeks retracing ground it has already covered." },
      Venus: { glyph: "♀",
        retro:  "This period suits reappraising what you already value more than committing to something new, in money as much as in relationships.",
        direct: "Venus resumes forward motion, and questions about worth that have been reopening tend to settle." },
      Mars: { glyph: "♂",
        retro:  "Compass reads this as suiting strategy over the push, with more resistance than usual meeting anything forced.",
        direct: "Mars turns forward, and plans that have been stalling tend to pick up again over the next two weeks." },
      Jupiter: { glyph: "♃",
        retro:  "Growth reads as inward for the months ahead, consolidating what earlier expansion brought instead of reaching for more.",
        direct: "Jupiter turns forward, and whatever you consolidated over the retrograde becomes the base to build on." },
      Saturn: { glyph: "♄",
        retro:  "This is a review of structures already built rather than a season for laying new foundations.",
        direct: "Saturn turns forward, and commitments that were under review can be settled." },
    };
    const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
    for (const planet of PLANETS) {
      const notes = STATION_NOTES[planet];
      let prevRetro = isRetrograde(planet, startJd);
      for (let jd = startJd + 1; jd <= endJd; jd += 1) {
        const cur = isRetrograde(planet, jd);
        if (cur === prevRetro) continue;
        const at = refine(jd - 1, jd, (m) => isRetrograde(planet, m) === cur);
        const note = cur ? notes.retro : notes.direct;
        const planetSign = getPlanetPositions(at).find(p => p.planet === planet)?.sign;
        entries.push({
          at: jdToIso(at), kind: "station", glyph: notes.glyph,
          title: `${planet} turns ${cur ? "retrograde" : "direct"}`,
          note,
          ...(planetSign ? houseOf(planetSign) : {}),
        });
        prevRetro = cur;
      }
    }
  }

  // ── Solar ingresses: the seasonal spine the months hang on ──
  {
    const signIdx = (jd: number) => Math.floor(((sunLongitude(jd) % 360) + 360) % 360 / 30);
    let prev = signIdx(startJd);
    for (let jd = startJd + 1; jd <= endJd; jd += 1) {
      const cur = signIdx(jd);
      if (cur === prev) continue;
      const at = refine(jd - 1, jd, (m) => signIdx(m) === cur);
      const sign = SIGNS[cur];
      // Equinoxes and solstices are the four ingresses everyone already keeps,
      // so they are named as themselves rather than as a sign change.
      const CARDINAL: Record<string, string> = {
        Aries: "Spring equinox", Cancer: "Summer solstice",
        Libra: "Autumn equinox", Capricorn: "Winter solstice",
      };
      entries.push({
        at: jdToIso(at), kind: "ingress", glyph: "☉",
        title: CARDINAL[sign] ? `${CARDINAL[sign]} — Sun enters ${sign}` : `Sun enters ${sign}`,
        note: CARDINAL[sign]
          ? `The season turns here, and Compass shifts the background character of every reading with it.`
          : `The month's background character shifts toward ${sign}.`,
        ...houseOf(sign),
      });
      prev = cur;
    }
  }

  entries.push(...aspectEntries(now, tzOffsetMin, endJd, jdToIso));

  // ── Angle crossings (opt-in) — "I still want to be able to see planetary
  // crossings on the almanac" (owner 2026-09-03). Location-dependent, so only
  // computed when a real lat/lon was given, and capped well short of the
  // 90-day fixed-event horizon: at roughly one a day, folding them in over
  // the full horizon would make crossings most of the list.
  if (personal?.lat != null && personal?.lon != null && personal.includeCrossings) {
    const crossingDays = Math.min(days, CROSSING_HORIZON_DAYS);
    for (let d = 0; d < crossingDays; d++) {
      const dayJd = Math.floor(startJd) + d;
      const hits = getNextAngularCrossings(dayJd, personal.lat, personal.lon, 40, 24).filter(isSignificantCrossing);
      for (const c of hits) {
        const at = new Date(c.crossingTime);
        if (at.getTime() < now.getTime()) continue; // this day's scan can reach back before `now`
        entries.push({
          at: c.crossingTime, kind: "crossing", glyph: "◈",
          title: `${c.planet} crosses your ${c.angle}`,
          // NOT c.durationMinutes — that is how long the planet sits inside
          // the wide 40° orb this scan uses to FIND the crossing (the same
          // orb /tides/week uses), which runs hours and would say "a brief
          // window, about 300 minutes" — the actual meaningful window is the
          // ~26-minute one around exact contact, the figure quoted everywhere
          // else a crossing is described (AgendaView, the removed Calendar
          // panel, lib/crossingPlans.ts's HALF_WINDOW_MIN). Two different
          // numbers for "how long is a crossing" would be the void-Moon
          // copy mistake again.
          note: `A brief window, about 26 minutes, when ${c.planet}'s themes peak.`,
        });
      }
    }
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
}

