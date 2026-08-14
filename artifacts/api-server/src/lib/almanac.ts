import {
  julianDay, SIGNS, sunLongitude, moonLongitude, isRetrograde, eclipseWindow,
} from "./astro.js";

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
  kind: "lunation" | "quarter" | "station" | "ingress";
  title: string;
  note: string;
  glyph: string;
  eclipse?: "solar" | "lunar";
};

export function buildAlmanac(now: Date, days: number): AlmanacEntry[] {
  const startJd = julianDay(now);
  const endJd = startJd + days;

  const entries: AlmanacEntry[] = [];
  const jdToIso = (jd: number) => new Date((jd - 2440587.5) * 86400000).toISOString();

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
        entries.push({
          at: jdToIso(at), kind: "station", glyph: notes.glyph,
          title: `${planet} turns ${cur ? "retrograde" : "direct"}`,
          note,
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
      });
      prev = cur;
    }
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
}

