/**
 * Electional astrology ("Launch") scoring engine.
 *
 * Implements the v1 ruleset in knowledge/electional-astrology-v1/. Scores a
 * candidate moment against universal rules (VOC, via combusta, Moon's last
 * degree, Moon's separating/applying aspects, Mercury retrograde, eclipse
 * proximity, malefic-afflicted angles) plus category-specific house/ruler
 * checks, and surfaces the checklist itself — not a bare score — per
 * 01_universal_rules.md's closing principle.
 *
 * Uses the election moment's OWN chart (whole-sign houses from its own
 * Ascendant, computed for the venture's location), not the user's natal
 * chart. This is the classical general-election method and means Launch
 * works without requiring birth data — a natal-informed refinement is a
 * defensible v2 extension, not a v1 requirement.
 */

import {
  SIGNS,
  julianDay,
  moonLongitude,
  sunLongitude,
  isRetrograde,
  getPlanetPositions,
  voidOfCourse,
  getMajorAspects,
  getLastMoonAspect,
  getLocalAngles,
  getPlanetaryHour,
} from "./astro.js";
import { SIGN_RULERS } from "./natal.js";
import { an } from "./article.js";

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(normalize360(a - b));
  return d > 180 ? 360 - d : d;
}

// ── Eclipses ──────────────────────────────────────────────────────────────
// Small rolling table, mirrored from artifacts/tides/src/lib/conditions.ts
// (frontend keeps its own copy for the Currents display; this is the
// backend's copy for scoring). Source: NASA eclipse canon.
const ECLIPSE_DATES = [
  "2026-02-17", "2026-03-03", "2026-08-12", "2026-08-28",
  "2027-02-06", "2027-07-18", "2027-08-02",
];

function nearestEclipseDays(date: Date): number {
  const t = date.getTime();
  let best = Infinity;
  for (const iso of ECLIPSE_DATES) {
    const days = Math.abs((new Date(iso + "T12:00:00Z").getTime() - t) / 86400000);
    if (days < best) best = days;
  }
  return best;
}

// ── Categories ────────────────────────────────────────────────────────────

export type ElectionWeight = "light" | "standard" | "heavy";

// How Mercury retrograde bears on a category:
//   hard      — classically disqualifying (contracts, publishing, financial commitments)
//   soft      — a mild caution, not disqualifying
//   favorable — the retrograde actually SUITS this beginning (drafting, revision)
export type MercuryRetroMode = "hard" | "soft" | "favorable";

export interface ElectionCategory {
  key: string;
  label: string;
  houses: number[];           // relevant whole-sign houses, from the moment's own ASC
  significators: string[];    // co-significator planets, for ruler-condition checks
  mercuryRetro: MercuryRetroMode;
  mercuryRetroNote?: string;  // category-specific copy shown when Mercury is retrograde
  preferredHourRulers: string[]; // planetary-hour rulers that sharpen this category
  weight: ElectionWeight;      // classical "stakes" — governs how much checklist detail the UI shows
  description: string;
}

// Ordered by stakes, lightest first — the picker renders in this order, so the
// everyday elections lead and the tradition's high-scrutiny ones (contracts,
// marriage) sit at the end where their weight is legible.
export const ELECTION_CATEGORIES: ElectionCategory[] = [
  {
    key: "habit_start", label: "New habit or practice",
    houses: [6], significators: [], mercuryRetro: "soft",
    preferredHourRulers: [], weight: "light",
    description: "Starting a daily practice — exercise, meditation, a wellness routine.",
  },
  {
    key: "date", label: "Scheduling a date",
    houses: [5], significators: ["Venus"], mercuryRetro: "soft",
    preferredHourRulers: ["Venus"], weight: "light",
    description: "A first date, or a date that matters.",
  },
  {
    key: "travel_short", label: "Short trip",
    houses: [3], significators: ["Mercury"], mercuryRetro: "soft",
    preferredHourRulers: ["Mercury", "Jupiter"], weight: "light",
    description: "Local or short-distance travel.",
  },
  {
    key: "conversation", label: "An important conversation",
    houses: [3, 7], significators: ["Mercury"], mercuryRetro: "soft",
    mercuryRetroNote: "Mercury is retrograde — fine for revisiting old ground or clearing the air, but expect to restate things; save brand-new proposals for after it turns direct.",
    preferredHourRulers: ["Mercury", "Venus"], weight: "light",
    description: "Raising something difficult, making an ask, clearing the air.",
  },
  {
    key: "writing_start", label: "Starting a writing project",
    houses: [3], significators: ["Mercury"], mercuryRetro: "favorable",
    mercuryRetroNote: "Mercury retrograde suits this — drafting, revising, and returning to old material are classically favored under it. Just hold publication until it turns direct.",
    preferredHourRulers: ["Mercury", "Jupiter"], weight: "standard",
    description: "Beginning a manuscript, essay, or body of writing (releasing it is a separate election).",
  },
  {
    key: "creative_launch", label: "Creative project launch",
    houses: [5], significators: ["Sun", "Venus"], mercuryRetro: "soft",
    preferredHourRulers: ["Sun", "Venus"], weight: "standard",
    description: "Debuting art, performance, or a creative body of work.",
  },
  {
    key: "job_application", label: "Submitting a job application",
    houses: [10, 6], significators: ["Mercury", "Sun"], mercuryRetro: "soft",
    mercuryRetroNote: "Mercury is retrograde — applications sent now tend to need follow-up or resubmission. Double-check every document, and don't be surprised by delays in hearing back.",
    preferredHourRulers: ["Mercury", "Sun"], weight: "standard",
    description: "Sending an application or pitch for a position you want.",
  },
  {
    key: "job_start", label: "Starting a new job",
    houses: [6, 10], significators: ["Sun", "Saturn"], mercuryRetro: "soft",
    preferredHourRulers: ["Sun", "Mercury"], weight: "standard",
    description: "First day at a new position or role.",
  },
  {
    key: "travel_long", label: "Long journey",
    houses: [9, 4], significators: ["Jupiter"], mercuryRetro: "soft",
    preferredHourRulers: ["Jupiter", "Sun"], weight: "standard",
    description: "International or long-distance travel, relocation journeys.",
  },
  {
    key: "publishing", label: "Publishing or releasing",
    houses: [9, 3], significators: ["Mercury", "Jupiter"], mercuryRetro: "hard",
    preferredHourRulers: ["Mercury", "Jupiter"], weight: "standard",
    description: "Releasing a publication, launching content into the world.",
  },
  {
    key: "business_launch", label: "Business or product launch",
    houses: [10, 1], significators: ["Sun", "Saturn"], mercuryRetro: "soft",
    mercuryRetroNote: "Mercury is retrograde — not disqualifying for a launch, but expect messaging, contracts, and logistics to need another pass once it turns direct. Build the follow-up adjustment into the plan.",
    preferredHourRulers: ["Sun", "Jupiter"], weight: "heavy",
    description: "Opening a business, launching a product or website, going public with a venture.",
  },
  {
    key: "home_purchase", label: "Home purchase or move",
    houses: [4], significators: ["Moon", "Saturn"], mercuryRetro: "soft",
    preferredHourRulers: ["Moon", "Saturn"], weight: "heavy",
    description: "Closing on a home, signing a lease, moving in.",
  },
  {
    key: "financial_venture", label: "Financial venture",
    houses: [2, 8], significators: ["Venus", "Jupiter"], mercuryRetro: "hard",
    preferredHourRulers: ["Jupiter", "Venus"], weight: "heavy",
    description: "Investments, loans, major purchases or financial commitments.",
  },
  {
    key: "contract", label: "Signing a contract",
    houses: [7, 3], significators: ["Mercury"], mercuryRetro: "hard",
    preferredHourRulers: ["Mercury", "Jupiter"], weight: "heavy",
    description: "Signing agreements, publishing deals, formal commitments in writing.",
  },
  {
    key: "marriage", label: "Marriage or partnership",
    houses: [7], significators: ["Venus", "Moon"], mercuryRetro: "soft",
    preferredHourRulers: ["Venus", "Sun"], weight: "heavy",
    description: "Weddings, formalizing a partnership, relationship commitments.",
  },
];

export function getElectionCategory(key: string): ElectionCategory | undefined {
  return ELECTION_CATEGORIES.find((c) => c.key === key);
}

// ── Rule checklist ────────────────────────────────────────────────────────

export interface ElectionRule {
  key: string;
  label: string;
  severity: "hard" | "soft" | "support";
  passed: boolean;   // true = clear/satisfied, false = triggered/failed
  detail: string;
  /**
   * Where this rule comes from, and whether practitioners actually agree on it.
   *
   * A verdict of "avoid" is a strong thing to tell someone, and Compass was
   * phrasing its hardest rules as settled fact ("classically avoided …
   * regardless of how the Moon looks"). Some of them ARE near-universal
   * (don't elect into an eclipse); others are genuinely disputed, and an
   * astrologer who disagrees should be able to see that Compass knows it is
   * taking a position rather than reporting consensus.
   *
   * A ruleset may hold an opinion. It should not pretend the opinion is
   * uncontested.
   */
  source?: "classical" | "compass";
  /** Named dissent, when the rule is genuinely contested. Shown with the rule. */
  dispute?: string;
}

/** Which ruleset produced a verdict — surfaced so the user can see Compass is
 *  applying ONE tradition, not speaking for astrology as a whole. */
export const ELECTION_RULESET = "Compass classical default (Hampar / DeLuce / March)";

export type ElectionVerdict = "strong" | "workable" | "caution" | "avoid";

export interface ElectionResult {
  /** The ruleset this verdict was produced by — stored with the result so an
   *  election recorded today still reports what judged it after rules change. */
  ruleset?: string;
  date: string;             // ISO instant scored
  windowStart: string;      // ISO — start of the planetary-hour block this result represents
  windowEnd: string;        // ISO — end of that block
  category: string;
  verdict: ElectionVerdict;
  rules: ElectionRule[];
  planetaryHour: string;
  planetaryHourMatch: boolean;
  summary: string;
}

const HARD_ASPECTS = new Set(["square", "opposition"]);
const SOFT_ASPECTS = new Set(["sextile", "trine"]);
const BENEFICS = new Set(["Venus", "Jupiter"]);

function wholeSignHouseSign(ascSign: string, houseNumber: number): string {
  const ascIdx = SIGNS.indexOf(ascSign);
  return SIGNS[(ascIdx + houseNumber - 1) % 12];
}

/** Scores a single moment against universal rules + the given category. */
export function scoreElection(date: Date, latDeg: number, lonDeg: number, categoryKey: string): ElectionResult {
  const category = getElectionCategory(categoryKey);
  if (!category) throw new Error(`Unknown election category: ${categoryKey}`);

  const jd = julianDay(date);
  const moonLon = normalize360(moonLongitude(jd));
  const rules: ElectionRule[] = [];

  // 1. Void of course Moon — hard
  const { voc } = voidOfCourse(jd);
  rules.push({
    key: "voc", label: "Moon void of course", severity: "hard", passed: !voc,
    detail: voc
      ? "The Moon perfects no further aspect before changing sign — classically read as \"nothing comes of it.\" Avoid launching here; fine for finishing or resting."
      : "The Moon is not void — she still has an aspect to perfect before leaving her sign.",
  });

  // 2. Via combusta — soft (15° Libra through 15° Scorpio, i.e. 195°-225°)
  const viaCombusta = moonLon >= 195 && moonLon < 225;
  rules.push({
    key: "via_combusta", label: "Via combusta", severity: "soft", passed: !viaCombusta,
    detail: viaCombusta
      ? "The Moon is in the \"burnt\" stretch from mid-Libra through mid-Scorpio — classically read as unstable or erratic."
      : "The Moon is clear of the via combusta.",
  });

  // 3. Moon in her final degree — soft
  const moonDegInSign = moonLon % 30;
  const lastDegree = moonDegInSign >= 29;
  rules.push({
    key: "moon_last_degree", label: "Moon in her final degree", severity: "soft", passed: !lastDegree,
    detail: lastDegree
      ? "The Moon is in the last degree of her sign — about to run out of room to develop before her character changes."
      : "The Moon has room left in her sign to develop.",
  });

  // 4. Moon separating from a hard aspect with nothing supportive following — soft
  const lastAspect = getLastMoonAspect(jd);
  const currentAspects = getMajorAspects(jd);
  const moonApplying = currentAspects
    .filter((a) => (a.planet1 === "Moon" || a.planet2 === "Moon") && a.applying && a.hoursToExact != null)
    .sort((a, b) => (a.hoursToExact ?? 999) - (b.hoursToExact ?? 999));
  const nextApplying = moonApplying[0] ?? null;
  const lastWasHard = !!lastAspect && HARD_ASPECTS.has(lastAspect.aspect);
  const nextIsRelief = !!nextApplying && SOFT_ASPECTS.has(nextApplying.aspect);
  const frictionCarriesForward = lastWasHard && !nextIsRelief;
  rules.push({
    key: "moon_friction", label: "Moon separating from friction with no near relief", severity: "soft",
    passed: !frictionCarriesForward,
    detail: lastAspect
      ? frictionCarriesForward
        ? `The Moon's last perfected aspect was ${an(lastAspect.aspect)} to ${lastAspect.planet} (${lastAspect.hoursAgo}h ago) with no easy aspect following soon — friction carries forward.`
        : `The Moon's last perfected aspect was ${an(lastAspect.aspect)} to ${lastAspect.planet}${nextIsRelief ? `, and her next applying aspect (${nextApplying!.aspect} to ${nextApplying!.planet1 === "Moon" ? nextApplying!.planet2 : nextApplying!.planet1}) offers relief` : ""}.`
      : "No recent perfected Moon aspect found in the lookback window.",
  });

  // 5. Mercury retrograde — hard, soft, or genuinely favorable, per category.
  // Writing/revision work classically SUITS a retrograde; only release-into-
  // the-world categories (publishing, contracts, financial commitments) treat
  // it as disqualifying.
  const mercRetro = isRetrograde("Mercury", jd);
  const retroDetail = mercRetro
    ? category.mercuryRetroNote ?? (
        category.mercuryRetro === "hard"
          // Was: "…classically avoided …, regardless of how the Moon looks."
          // That last clause asserted that no other testimony could matter,
          // which is a position, not a fact — and the astrologers most likely
          // to trust Compass are exactly the ones who would contest it.
          ? "This ruleset treats Mercury retrograde as disqualifying for signing, publishing, or committing in writing."
          : "Mercury is retrograde — a mild caution for anything communication- or contract-adjacent, though not disqualifying for this category."
      )
    : "Mercury is direct.";
  rules.push({
    key: "mercury_retrograde",
    label: category.mercuryRetro === "favorable" && mercRetro ? "Mercury retrograde (suits this work)" : "Mercury retrograde",
    severity: category.mercuryRetro === "hard" ? "hard" : category.mercuryRetro === "favorable" ? "support" : "soft",
    // For favorable categories the retrograde is a positive signal, not a failure.
    passed: category.mercuryRetro === "favorable" ? true : !mercRetro,
    detail: retroDetail,
    source: "classical",
    // Genuinely contested — worth saying so rather than implying consensus.
    dispute: mercRetro && category.mercuryRetro === "hard"
      ? "Practitioners differ. Many accept a retrograde for a REturn — a relaunch, a renewal, a revision, resuming something paused — and read it as hostile mainly to genuinely new beginnings."
      : undefined,
  });

  // 6. Eclipse within ~3 days — hard
  const eclipseDays = nearestEclipseDays(date);
  const nearEclipse = eclipseDays <= 3;
  rules.push({
    key: "eclipse_proximity", label: "Near an eclipse", severity: "hard", passed: !nearEclipse,
    detail: nearEclipse
      ? `Within ${eclipseDays.toFixed(1)} days of an eclipse — a launch this close tends to run hot and change shape faster than planned.`
      : "No eclipse within the 3-day caution window.",
    // Near-universal across traditions — no dispute note, because inventing
    // controversy where there is none is its own kind of dishonesty.
    source: "classical",
  });

  // 7. Malefic afflicting the moment's own Ascendant (hard aspect, orb <= 3°) — hard
  const angles = getLocalAngles(jd, latDeg, lonDeg);
  const planets = getPlanetPositions(jd);
  const ascAfflictions = planets.filter((p) => {
    if (p.planet !== "Mars" && p.planet !== "Saturn") return false;
    const sep = angularDiff(p.longitude, angles.asc);
    return (Math.abs(sep - 90) <= 3 || Math.abs(sep - 180) <= 3 || sep <= 3);
  });
  rules.push({
    key: "malefic_on_asc", label: "Malefic afflicting the Ascendant", severity: "hard",
    passed: ascAfflictions.length === 0,
    detail: ascAfflictions.length > 0
      ? `${ascAfflictions.map((p) => p.planet).join(" and ")} closely afflicts the Ascendant — whatever governs this venture starts under strain.`
      : "No malefic closely afflicting the Ascendant.",
  });

  // 8. Waxing Moon — support
  const sunLon = normalize360(sunLongitude(jd));
  const elongation = normalize360(moonLon - sunLon);
  const waxing = elongation < 180;
  rules.push({
    key: "waxing_moon", label: "Waxing Moon", severity: "support", passed: waxing,
    detail: waxing
      ? "The Moon is waxing — favorable for anything meant to grow."
      : "The Moon is waning — better suited to completions and endings than new growth.",
  });

  // 9. Moon's first applying aspect is to a benefic by soft aspect — support
  const benefitApplying = !!nextApplying && SOFT_ASPECTS.has(nextApplying.aspect) &&
    BENEFICS.has(nextApplying.planet1 === "Moon" ? nextApplying.planet2 : nextApplying.planet1);
  rules.push({
    key: "moon_first_aspect", label: "Moon's first applying aspect favors a benefic", severity: "support",
    passed: benefitApplying,
    detail: nextApplying
      ? benefitApplying
        ? `The Moon's first applying aspect is ${an(nextApplying.aspect)} to ${nextApplying.planet1 === "Moon" ? nextApplying.planet2 : nextApplying.planet1} — the strongest single good omen in the tradition.`
        : `The Moon's next applying aspect is ${an(nextApplying.aspect)} to ${nextApplying.planet1 === "Moon" ? nextApplying.planet2 : nextApplying.planet1} — not a benefic soft aspect.`
      : "No applying Moon aspect found in the near term.",
  });

  // 10. Relevant house ruler(s) well-placed (direct, not combust) — support.
  // Was: only category.houses[0] — a contract's 3rd house (communication)
  // never got checked alongside its 7th (the other party), and any category
  // with a secondary house was silently graded on one signal instead of the
  // full matter (audit F8). Now checks every relevant house; passes if any
  // one ruler is well-placed, same traditional logic as a single house.
  const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  const houseRulerReports = category.houses.map((house) => {
    const sign = wholeSignHouseSign(angles.ascSign, house);
    const ruler = SIGN_RULERS[sign];
    const rulerPlanet = planets.find((p) => p.planet === ruler);
    if (!rulerPlanet) return { house, sign, ruler, good: null as boolean | null, detail: `${ruler} rules the ${ordinal(house)} house — no ruler data available.` };
    const combust = ruler !== "Sun" && angularDiff(rulerPlanet.longitude, sunLon) <= 8;
    const good = !rulerPlanet.retrograde && !combust;
    return {
      house, sign, ruler, good,
      detail: `${ruler} rules the ${ordinal(house)} house (${sign} on the cusp) and is ${rulerPlanet.retrograde ? "retrograde" : "direct"}${combust ? ", combust (too close to the Sun)" : ""}.`,
    };
  });
  const rulersWithData = houseRulerReports.filter((r) => r.good !== null);
  const rulerGood = rulersWithData.length === 0 || rulersWithData.some((r) => r.good === true);
  const rulerDetail = houseRulerReports.length ? houseRulerReports.map((r) => r.detail).join(" ") : "No ruler data available.";
  rules.push({
    key: "house_ruler", label: "House ruler well-placed", severity: "support", passed: rulerGood, detail: rulerDetail,
  });

  // Planetary hour match
  const planHour = getPlanetaryHour(date, latDeg, lonDeg);
  const hourMatch = category.preferredHourRulers.includes(planHour.ruler);

  // ── Verdict ──
  const hardFailed = rules.filter((r) => r.severity === "hard" && !r.passed);
  const softFailed = rules.filter((r) => r.severity === "soft" && !r.passed);
  const supportsMet = rules.filter((r) => r.severity === "support" && r.passed).length;

  let verdict: ElectionVerdict;
  if (hardFailed.length > 0) verdict = "avoid";
  else if (softFailed.length === 0 && supportsMet >= 2) verdict = "strong";
  else if (softFailed.length <= 1 && supportsMet >= 1) verdict = "workable";
  else verdict = "caution";

  // An "avoid" says which ruleset is refusing and why — not "the stars forbid
  // this" but "this ruleset blocks it, on these grounds". The dispute notes
  // ride on the rules themselves so the user can weigh the objection.
  const summary = hardFailed.length > 0
    ? `${ELECTION_RULESET} withholds this window: ${hardFailed.map((r) => r.label.toLowerCase()).join(", ")}.`
    : verdict === "strong"
      ? "A strong window — the checklist is clear and multiple supports are active."
      : verdict === "workable"
        ? "A workable window — nothing disqualifying, though not every support is present."
        : "Usable in a pinch, but several soft cautions are active with few supports.";

  return {
    date: date.toISOString(),
    windowStart: planHour.startTime.toISOString(), windowEnd: planHour.endTime.toISOString(),
    category: categoryKey, verdict, rules,
    planetaryHour: planHour.ruler, planetaryHourMatch: hourMatch, summary,
    // Which ruleset spoke. Saved with the result so a verdict recorded today
    // still says what it was judged by after the rules change.
    ruleset: ELECTION_RULESET,
  };
}

// ── Date-range scan ───────────────────────────────────────────────────────

export interface ElectionScanResult {
  category: string;
  windows: ElectionResult[];
  hardBlock?: { rule: string; clearsOn: string | null };
}

const VERDICT_RANK: Record<ElectionVerdict, number> = { strong: 3, workable: 2, caution: 1, avoid: 0 };

/**
 * Scans planetary-hour boundaries across a date range and scores each,
 * returning the best windows first. Mirrors /api/tides/windows's boundary
 * walk, extended across multiple days and layered with the full checklist.
 */
export function scanElection(
  categoryKey: string, startDate: Date, days: number, latDeg: number, lonDeg: number,
): ElectionScanResult {
  const category = getElectionCategory(categoryKey);
  if (!category) throw new Error(`Unknown election category: ${categoryKey}`);

  const results: ElectionResult[] = [];
  const seen = new Set<string>();
  let cursor = new Date(startDate.getTime());
  const rangeEnd = new Date(startDate.getTime() + days * 86400000);

  while (cursor < rangeEnd && results.length < 400) {
    const planHour = getPlanetaryHour(cursor, latDeg, lonDeg);
    const key = planHour.startTime.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      const mid = new Date((planHour.startTime.getTime() + planHour.endTime.getTime()) / 2);
      results.push(scoreElection(mid, latDeg, lonDeg, categoryKey));
    }
    // Guard against a corrupted/stale planetary-hour boundary ever sending the
    // cursor backward or nowhere — without this, a bad endTime turned a scan
    // into a spin that could return windows dated over a year in the past
    // (audit F1, empirically observed at eastern longitudes before the
    // getPlanetaryHour local-date fix). Only intervenes when the natural
    // next boundary fails to advance; a real (variable-length) hour is left
    // as-is so the scan doesn't skip legitimately short hours.
    const next = planHour.endTime.getTime() + 60000;
    cursor = next > cursor.getTime() ? new Date(next) : new Date(cursor.getTime() + 3600000);
  }

  results.sort((a, b) => {
    const rankDiff = VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict];
    if (rankDiff !== 0) return rankDiff;
    if (a.planetaryHourMatch !== b.planetaryHourMatch) return a.planetaryHourMatch ? -1 : 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const scan: ElectionScanResult = { category: categoryKey, windows: results.slice(0, 30) };

  // If Mercury retrograde is a hard block for this category and it's currently
  // active, tell the user honestly when it clears rather than silently hiding
  // every window in the range (per 05_safety_and_limits.md's "never manufacture
  // a false all-clear" principle).
  if (category.mercuryRetro === "hard" && isRetrograde("Mercury", julianDay(startDate))) {
    let clearsOn: string | null = null;
    for (let d = 0; d <= 90; d++) {
      const check = new Date(startDate.getTime() + d * 86400000);
      if (!isRetrograde("Mercury", julianDay(check))) { clearsOn = check.toISOString().slice(0, 10); break; }
    }
    scan.hardBlock = { rule: "mercury_retrograde", clearsOn };
  }

  return scan;
}
