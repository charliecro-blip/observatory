/**
 * Compass timing API.
 *
 * GET /api/tides/now      — Current timing snapshot: element, planetary hour, VOC, quality label
 * GET /api/tides/windows  — Upcoming timing windows (next 12 hours in 2-hour blocks)
 */
import { Router, type IRouter } from "express";
import {
  julianDay, moonPhase, getPlanetPositions,
  voidOfCourse, getPlanetaryHour, getDailyElementEmphasis,
  getMajorAspects, getAspectOrbs, getLocalAngles, getAngularPlanets,
  getLastMoonAspect, getNextAngularCrossings, getSunriseSunset,
  SIGNS, sunLongitude, moonLongitude, isRetrograde, eclipseWindow,
} from "../lib/astro.js";
import { db } from "@workspace/db";
import { natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";
import { computeTide, PLANET_TO_ELEMENT, type TideAspectLite } from "../lib/tide.js";
import { computeDayArc, findPeakWindows, nextIngressAfterMs } from "../lib/dayarc.js";
import { dayReading } from "../lib/synthesis.js";
import { domicileLord } from "../lib/dignity.js";
import { planetInSign } from "../lib/planetInSign.js";
import { voidReading, VOID_SCOPE } from "../lib/voidOfCourse.js";
import { newMoonDates, nextNewMoonDate } from "../lib/lunarCycle.js";
import { buildAlmanac } from "../lib/almanac.js";

const router: IRouter = Router();

// Format a UTC instant as a 12h wall-clock string in the viewer's timezone.
// tzOffsetMin follows Date.getTimezoneOffset (minutes to add to local to reach UTC).
function clockLocal(d: Date, tzOffsetMin: number): string {
  const s = new Date(d.getTime() - tzOffsetMin * 60000);
  let h = s.getUTCHours();
  const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Seed rule data (inlined from auspice-seed-rules-v1.json) ─────────────────

const PLANETARY_HOUR_RULES: Record<string, {
  prompt: string;
  supports: string[];
}> = {
  Moon:    { prompt: "What needs care, nourishment, or a gentler rhythm?", supports: ["body care", "home", "rest", "emotional processing", "food", "care", "domestic rhythms"] },
  Mercury: { prompt: "What needs to be named, written, sorted, or communicated?", supports: ["writing", "calls", "email", "scheduling", "study", "editing", "sorting", "commerce"] },
  Venus:   { prompt: "What would become easier if you softened, beautified, or connected?", supports: ["art", "design", "relational care", "pleasure", "invitations", "aesthetic refinement", "dates"] },
  Mars:    { prompt: "What needs courage, movement, or a clean cut?", supports: ["movement", "action", "exercise", "boundary work", "errands", "hard edits", "decisive problem-solving"] },
  Jupiter: { prompt: "What wants to grow, be shared, or be understood in a larger frame?", supports: ["teaching", "publishing", "big-picture planning", "outreach", "generosity", "study", "launches"] },
  Saturn:  { prompt: "What needs structure, patience, or maintenance?", supports: ["structure", "discipline", "planning", "accounting", "cleanup", "commitments", "maintenance", "finishing"] },
  Sun:     { prompt: "What would restore your vitality — or deserves your whole heart?", supports: ["vitality", "creative work", "a clear decision", "integrity", "warmth", "the essential task"] },
};

const VOC_SUPPORTS = ["rest", "cleanup", "review", "finishing", "routine", "spiritual practice", "reflection", "maintenance"];
const VOC_CAUTIONS = ["major launch", "important beginning", "high-stakes commitment", "signing contracts", "pitches and requests"];

const ELEMENT_QUALITIES: Record<string, { quality: string; invitation: string }> = {
  fire:   { quality: "active",      invitation: "Vital force is available. This window supports initiation, expression, and movement." },
  earth:  { quality: "grounding",   invitation: "Steady rhythm is present. This window supports tending, building, and material care." },
  air:    { quality: "clarifying",  invitation: "Mental currents are open. This window supports communication, study, and connection." },
  water:  { quality: "receptive",   invitation: "The tide is inward. This window supports feeling, reflection, and emotional depth." },
  spirit: { quality: "liminal",     invitation: "The field is between states. This window is for rest, inner listening, and releasing what does not need force." },
};

// ── /api/tides/now ─────────────────────────────────────────────────────────

router.get("/tides/now", async (req, res) => {
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  // Viewer's tz offset in minutes (Date.getTimezoneOffset convention). Used to build
  // the day-arc around the viewer's local midnight rather than the server's (UTC).
  const tzOffset = Number.isFinite(parseInt((req.query.tz as string) ?? "", 10))
    ? parseInt((req.query.tz as string), 10)
    : 0;
  const date = new Date();
  const jd   = julianDay(date);

  // Optional personal transits — computed when x-tester-id header is present
  const testerId = (req.headers["x-tester-id"] as string) ?? null;
  let personalTransits: Array<{
    transitPlanet: string;
    transitSign: string;
    aspect: string;
    natalPlanet: string;
    natalSign: string;
    natalHouse: number;
    orb: number;
    exact: boolean;
    severity: string;
    summary: string;
  }> = [];

  let ascRuler: string | undefined; // natal chart ruler — feeds the "doubled day" pattern
  let natalForReading: import("../lib/synthesis.js").NatalForReading | undefined; // personal testimony layer
  if (testerId) {
    try {
      const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
      if (stored) {
        const timeKnown = stored.timeKnown !== false;
        const natal = computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset);
        // Without a birth time the Ascendant is unknowable — leave ascRuler unset.
        if (timeKnown) ascRuler = domicileLord(natal.ascendant.longitude);
        natalForReading = {
          planets: natal.planets.map(p => ({ planet: p.planet, longitude: p.longitude })),
          asc: timeKnown ? natal.ascendant.longitude : undefined,
          mc: timeKnown ? natal.midheaven.longitude : undefined,
        };
        const transits = computeTransitAspects(natal);
        personalTransits = transits
          .filter((t) => t.severity === "strong" || t.severity === "major" || (t.severity === "moderate" && t.exact))
          // With no birth time, the Ascendant and houses are unknowable — drop
          // any transit to the Ascendant, and don't report house numbers.
          .filter((t) => timeKnown || t.natalPlanet !== "Ascendant")
          .slice(0, 12)
          .map((t) => ({
            transitPlanet: t.transitPlanet,
            transitSign:   t.transitSign,
            aspect:        t.aspect.toLowerCase(),
            natalPlanet:   t.natalPlanet,
            natalSign:     t.natalSign,
            natalHouse:    timeKnown ? t.natalHouse : 0,
            orb:           t.orb,
            exact:         t.exact,
            severity:      t.severity,
            summary:       `${t.transitPlanet} ${t.aspect.toLowerCase()} your natal ${t.natalPlanet}${t.exact ? " (exact)" : ` (${t.orb}°)`}`,
          }));
      }
    } catch (_) {
      // Gracefully skip transits if chart unavailable
    }
  }

  const planets        = getPlanetPositions(jd);
  const { name: moonPhaseName, fraction } = moonPhase(jd);
  const moonSign       = planets.find((p) => p.planet === "Moon")!.sign;
  const sunSign        = planets.find((p) => p.planet === "Sun")!.sign;
  const { voc }        = voidOfCourse(jd);
  const elemEmph       = getDailyElementEmphasis(jd);
  const planHour       = getPlanetaryHour(date, lat, lon);
  const retrogrades    = planets.filter((p) => p.retrograde).map((p) => p.planet);
  const INNER_PLANETS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars"]);
  const LUMINARIES = new Set(["Sun", "Moon"]);
  // Non-luminary pairs stay in orb for ages — only surface them when tight
  // (< 5 deg), or the "planetary weather" reads as permanently stormy.
  const allAspects     = getMajorAspects(jd).filter(a =>
    LUMINARIES.has(a.planet1) || LUMINARIES.has(a.planet2) || a.orb < 5);
  // Filter out outer-planet-only pairs — they stay in orb for months and feel stale
  const aspects        = allAspects.filter(a => INNER_PLANETS.has(a.planet1) || INNER_PLANETS.has(a.planet2));
  const localAngles    = getLocalAngles(jd, lat, lon);
  const angularPlanets = getAngularPlanets(jd, lat, lon);
  const lastMoonAspect = getLastMoonAspect(jd);

  // Moon's current applying aspects — most dynamically significant
  const moonAspects = aspects.filter((a) => a.planet1 === "Moon" || a.planet2 === "Moon");

  const hourRules   = PLANETARY_HOUR_RULES[planHour.ruler] ?? PLANETARY_HOUR_RULES.Sun;
  const elemQuality = ELEMENT_QUALITIES[elemEmph.element] ?? ELEMENT_QUALITIES.water;

  const ARCHETYPES: Record<string, string> = {
    Sun: "The Sovereign", Moon: "The Nurturer", Mercury: "The Messenger",
    Venus: "The Connector", Mars: "The Warrior", Jupiter: "The Sage", Saturn: "The Builder",
  };

  // Format a UTC instant as "HH:MM" in the VIEWER's timezone (tzOffset from the
  // query). toLocaleTimeString here formatted in the SERVER's timezone — UTC on
  // Railway — so every hour boundary the client displayed was wrong.
  function fmtTime(d: Date) {
    const s = new Date(d.getTime() - tzOffset * 60000);
    return `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`;
  }

  // Compute next 4 planetary hours
  const upcomingHours: Array<{ planet: string; time: string }> = [];
  let cursor = new Date(planHour.endTime.getTime() + 60000);
  while (upcomingHours.length < 4) {
    const next = getPlanetaryHour(cursor, lat, lon);
    upcomingHours.push({ planet: next.ruler, time: fmtTime(next.startTime) });
    cursor = new Date(next.endTime.getTime() + 60000);
  }

  // Enriched scoring: VOC -2, retrogrades -1, benefics angular +1 each, malefics angular -1 each,
  // applying Moon trine/sextile to benefic +1, applying Moon sq/opp malefic -1
  let score = 5;
  if (voc) score -= 2;
  if (retrogrades.length >= 2) score -= 1;
  if (elemEmph.element === "fire" || elemEmph.element === "air") score += 1;

  for (const ap of angularPlanets) {
    if (ap.benefic) score += 1;
    if (ap.malefic) score -= 1;
  }

  const BENEFIC_PLANETS = new Set(["Venus", "Jupiter"]);
  const MALEFIC_PLANETS = new Set(["Mars", "Saturn"]);
  for (const asp of moonAspects) {
    if (!asp.applying) continue;
    const other = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1;
    if ((asp.aspect === "trine" || asp.aspect === "sextile") && BENEFIC_PLANETS.has(other)) score += 1;
    if ((asp.aspect === "square" || asp.aspect === "opposition") && MALEFIC_PLANETS.has(other)) score -= 1;
  }

  const qualityLabel =
    score >= 8 ? "excellent" :
    score >= 5 ? "good" :
    score >= 2 ? "workable" :
    score >= -1 ? "mixed" : "avoid_if_possible";

  // ── Tide state (Character / Energy / Trend / Coherence axes) ────────────────
  const personalHardTransit = personalTransits.some(
    (t) => (t.aspect === "square" || t.aspect === "opposition") &&
           (t.severity === "strong" || t.severity === "major"),
  );
  // The woven reading first — the tide's headline derives FROM it (one brain).
  const reading = dayReading(date, lat, lon, { tzOffsetMin: tzOffset, ascRuler, natal: natalForReading });
  const support = reading.testimonies.filter(t => t.score > 0).reduce((a, t) => a + t.score, 0);
  const caution = reading.testimonies.filter(t => t.score < 0).reduce((a, t) => a - t.score, 0);

  const tide = computeTide({
    moonSign,
    illumination: fraction,
    phaseName: moonPhaseName,
    voc,
    moonAspects: moonAspects.map((a): TideAspectLite => ({ nature: a.nature, applying: a.applying, orb: a.orb })),
    angularCount: angularPlanets.length,
    hourElement: PLANET_TO_ELEMENT[planHour.ruler] ?? "air",
    personalHardTransit,
    reading: { element: reading.element, support, caution },
  });

  const DAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  // Day-of-week in the VIEWER's calendar, not the server's (getDay() on Railway
  // is UTC — after ~7-8pm US time it rolled to tomorrow's ruler).
  const dayRuler = DAY_RULERS[new Date(date.getTime() - tzOffset * 60000).getUTCDay()];

  // Next moon ingress — the moment the void LIFTS, which is the single number
  // people time a start against.
  //
  // This used to scan forward in one-HOUR steps and print the hour boundary as
  // an exact clock time: it reported "08:01 AM" for an ingress at 07:13:30, so
  // the app told you to wait 47 minutes longer than you had to. Up to a full
  // hour of error on the number the whole feature exists to supply.
  // nextIngressAfterMs brackets and then bisects to under a second.
  let nextIngress: string | null = null;
  if (voc) {
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const ingressMs = nextIngressAfterMs(date.getTime());
    const local = new Date(ingressMs - tzOffset * 60000);
    let hr = local.getUTCHours();
    const ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    const clock = `${String(hr).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")} ${ampm}`;
    nextIngress = ingressMs - date.getTime() >= 86400000
      ? `${WEEKDAYS[local.getUTCDay()]} ${clock}` : clock;
  }

  // Where the Moon is THROUGH her sign — always, not only during a void.
  //
  // The rail used to assert a flat "next 2½ days" for the Moon's mood, which is
  // the average length of a sign transit and therefore wrong almost always: on
  // a day the Moon changes sign at 3:36pm it told you the mood had two and a
  // half days left. A sign is ~2.2–2.6 days depending on lunar speed, so this
  // measures rather than assumes — bisected to under a second by
  // nextIngressAfterMs, the same function the VOC "until" label trusts.
  const moonLonNow = ((planets.find((p) => p.planet === "Moon")!.longitude % 360) + 360) % 360;
  const moonIngressMs = nextIngressAfterMs(date.getTime());
  const degIntoSign = moonLonNow % 30;
  const moonSignProgress = {
    // 0..1 through the current sign, by ecliptic degree (not by elapsed time —
    // lunar speed varies by ~12% over the month, and degree is what actually
    // defines the boundary).
    fraction: parseFloat((degIntoSign / 30).toFixed(3)),
    degreesIn: parseFloat(degIntoSign.toFixed(2)),
    endsAt: new Date(moonIngressMs).toISOString(),
    hoursLeft: parseFloat(((moonIngressMs - date.getTime()) / 3600000).toFixed(2)),
    nextSign: SIGNS[(Math.floor(moonLonNow / 30) + 1) % 12],
  };

  // WHERE IN THE LUNAR CYCLE — a real position in a real period.
  //
  // The hero drew a sine wave labelled LOW · RISING · HIGH · EBB · LOW with a
  // marker on it, and the owner asked the right question: "what is the cycle?"
  // There wasn't one. The wave was decorative and the marker was a five-way
  // lookup from a categorical tide level, so it could only jump between five
  // fixed stops on a period nothing computed.
  //
  // The lunar month is an actual cycle with an actual position, and it is
  // already the spine of the week chart. Position is elongation / 360, which is
  // its canonical definition: 0 = new, 0.25 = first quarter, 0.5 = full,
  // 0.75 = last quarter. Note this CANNOT be recovered from illumination alone —
  // 50% lit is both first and last quarter — which is exactly why the angle is
  // the source rather than the brightness.
  const sunLonNow = ((planets.find((p) => p.planet === "Sun")!.longitude % 360) + 360) % 360;
  const elongation = ((moonLonNow - sunLonNow) % 360 + 360) % 360;
  const moonCycle = {
    position: parseFloat((elongation / 360).toFixed(4)),
    elongationDeg: parseFloat(elongation.toFixed(2)),
    waxing: elongation < 180,
    phase: moonPhaseName,
    // The lunar cycle as an instruction, not an amount — the same six-word
    // vocabulary the week chart labels its days with, so the two surfaces
    // cannot drift apart.
    approach: elongation < 22.5 ? "initiate"
      : elongation < 112.5 ? "build"
      : elongation < 157.5 ? "refine"
      : elongation < 202.5 ? "release"
      : elongation < 292.5 ? "consolidate"
      : "recover",
    // WHERE THIS CYCLE ACTUALLY BEGINS AND ENDS, as dates on the viewer's own
    // calendar. Carried here rather than fetched separately because every
    // surface that needs it already reads /tides/now, and because a second
    // route computing the same boundary is how two surfaces come to disagree
    // about which cycle you are in.
    //
    // The turning-point check-in used to hold these as two hand-typed strings
    // per lunation, which drifted a day from the computed cycle the ledger
    // stamps intentions with (see lib/lunarCycle.ts, 2026-08-15).
    ...(() => {
      const { cycleStart, prevCycleStart } = newMoonDates(tzOffset);
      return { cycleStart, prevCycleStart, nextCycleStart: nextNewMoonDate(tzOffset) };
    })(),
  };

  // Rhythm risk: VOC + low quality + hard Moon-to-disruptive-natal-planet aspects
  const DISRUPTIVE_NATAL = new Set(["Saturn", "Uranus", "Pluto", "Mars"]);
  const natalDisruption = personalTransits.filter(t =>
    t.transitPlanet === "Moon" &&
    (t.aspect === "square" || t.aspect === "opposition") &&
    DISRUPTIVE_NATAL.has(t.natalPlanet)
  );
  const rhythmRiskFactors: string[] = [];
  if (voc) rhythmRiskFactors.push("Moon void of course");
  if (score <= 1) rhythmRiskFactors.push("low overall quality");
  if (natalDisruption.length > 0) rhythmRiskFactors.push(`Moon ${natalDisruption[0].aspect} natal ${natalDisruption[0].natalPlanet}`);
  const rhythmRisk = rhythmRiskFactors.length >= 2;

  // ── Solar cycle: daylight as part of the tides. Day length, its direction,
  // and where we are in the light-year (solstice-to-solstice). ─────────────
  const sunNow = getSunriseSunset(jd, lat, lon);
  const sunYest = getSunriseSunset(jd - 1, lat, lon);
  // Polar day/night has no sunrise to compare against — getSunriseSunset
  // substitutes a symmetric twelve-hour day, and comparing to that would flip
  // sect (and therefore the dignity labels it drives) for half of every polar
  // day. Sect is answerable there even though planetary hours are not.
  const isDaySect = sunNow.polar ? sunNow.polar === "day" : (date >= sunNow.sunrise && date < sunNow.sunset);
  const lenMin = Math.round((sunNow.sunset.getTime() - sunNow.sunrise.getTime()) / 60000);
  const deltaMin = Math.round((lenMin * 60000 - (sunYest.sunset.getTime() - sunYest.sunrise.getTime())) / 60000);
  // Light phase from the Sun's ecliptic longitude (season-accurate, hemisphere-aware)
  const sunLon = planets.find((p) => p.planet === "Sun")?.longitude ?? 90;
  const north = lat >= 0;
  // 90° = June solstice, 270° = December solstice
  const fromJune = ((sunLon - 90) + 360) % 360; // degrees past June solstice
  const nearJune = fromJune < 45 || fromJune > 315;
  const nearDec = Math.abs(fromJune - 180) < 45;
  const lightPhase =
    (north ? nearJune : nearDec) ? "high light" :
    (north ? nearDec : nearJune) ? "deep dark" :
    deltaMin >= 0 ? "light growing" : "light waning";

  res.json({
    timestamp: date.toISOString(),
    daylight: {
      sunrise: sunNow.sunrise.toISOString(),
      sunset: sunNow.sunset.toISOString(),
      lengthMin: lenMin,
      deltaMin,
      phase: lightPhase,
    },
    dayRuler,
    momentLabel: voc
      ? `Void Moon in ${moonSign}`
      : `${planHour.ruler} Hour — ${elemEmph.element.charAt(0).toUpperCase() + elemEmph.element.slice(1)} (${moonSign})`,
    quality: qualityLabel,
    qualityScore: score,
    element: elemEmph,
    planetaryHour: {
      planet:    planHour.ruler,
      began:     fmtTime(planHour.startTime),
      ends:      fmtTime(planHour.endTime),
      quality:   hourRules.prompt,
      archetype: ARCHETYPES[planHour.ruler],
      prompt:    hourRules.prompt,
      supports:  voc ? VOC_SUPPORTS : hourRules.supports,
      cautions:  voc ? VOC_CAUTIONS : [],
    },
    upcomingHours,
    voidOfCourse: voc,
    // `reading` is sign-specific: a void in Taurus and a void in Capricorn are
    // not the same afternoon, and Lilly exempts four signs outright — which
    // changes the counsel from "wait it out" to "use it". Only computed when
    // she is actually void; a reading attached to a non-void Moon would be a
    // fact about nothing.
    voc: { isVOC: voc, nextIngress, scope: voc ? VOID_SCOPE : null, reading: voc ? voidReading(moonSign) : null },
    moonPhase: moonPhaseName,
    moonFraction: fraction,
    moonIllumination: fraction, // alias for Rail component
    moonSign,
    moonSignProgress,
    moonCycle,
    sunSign,
    retrogrades,
    aspects,
    moonAspects,
    lastMoonAspect,
    // Every planet's current sign — a planet named without its sign is only
    // half the story, so the client puts "in {sign}" wherever a planet appears.
    // `reading` is what the planet can and cannot do FROM THIS SIGN. Naming
    // the planet and the sign and then printing generic planet copy said the
    // one thing the pair does not mean.
    //
    // Sect from the actual horizon, not from clock hours: dignity's exaltation
    // and triplicity terms differ by day and night, so "is the Sun up" has to
    // be the real answer or the four dignity labels are wrong half the time.
    planets: planets.map((p) => ({
      planet: p.planet, sign: p.sign, degree: parseFloat(p.degree.toFixed(2)), retrograde: p.retrograde,
      reading: planetInSign(p.planet, p.longitude, isDaySect),
    })),
    localAngles,
    angularPlanets,
    invitation: voc
      ? "The Moon is between signs. This is not the cleanest window for beginning something that needs momentum. It may be better for tending what is already in motion, resting, reviewing, or clearing loose ends."
      : elemQuality.invitation,
    personalTransits,
    rhythmRisk,
    rhythmRiskFactors,
    tide,
    dayArc: computeDayArc(date, lat, lon, tzOffset),
    // The woven reading — flavour/foci/watch/counterpoint/patterns/testimonies.
    // Computed above (the tide derives from it); the client gates depth by
    // astro-detail level.
    reading,
  });
});

// ── /api/tides/week ────────────────────────────────────────────────────────

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const WEEK_ELEMENT_TONES: Record<string, string> = {
  fire:   "Active and expressive. Good for initiating, moving, and bringing energy to what needs momentum.",
  earth:  "Grounding and steady. Good for tending, building, and attending to material rhythms.",
  air:    "Clear and connective. Good for writing, communication, study, and sorting through ideas.",
  water:  "Receptive and emotional. Good for reflection, rest, processing, and relational depth.",
  spirit: "Liminal. The Moon is between signs — a good day for rest, review, and releasing what does not need force.",
};

router.get("/tides/week", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  // A MONTH GRID NEEDS MORE THAN THIRTY FORWARD DAYS.
  //
  // The Calendar asks for 90 and silently received 30, always starting at
  // today — so the first half of the current month rendered blank (its days
  // are in the past) and so did anything past the cap. To someone looking at
  // August on the 13th, that is a month grid two-thirds empty, which reads
  // as "nothing is populating" (owner, 2026-08-13). The cap was a sensible
  // guard against an unbounded scan, not a statement about what a calendar
  // needs; 120 covers a month grid with both its overflow weeks.
  // The cap is a REAL guard, not a formality: this route costs roughly 70ms
  // per day and runs synchronously, so a caller asking for a season blocks
  // the event loop for ten seconds and starves every other request. 60 is
  // comfortably more than a month grid needs and still under two seconds
  // above what the page already paid.
  const numDays = Math.min(parseInt((req.query.days as string) ?? "7"), 60);
  // How many days BEFORE today to include. A calendar showing a month must
  // be able to draw the part of it that has already happened.
  // Same cost per day as forward, so capped in the same spirit. Together the
  // two bound one request at ~80 days, which is the ceiling this synchronous
  // route can carry without holding the event loop long enough to be felt.
  const backDays = Math.min(Math.max(parseInt((req.query.back as string) ?? "0", 10) || 0, 0), 20);
  // Viewer timezone offset — days must be the VIEWER's calendar days. On UTC
  // day boundaries, a US viewer's "today" straddles two UTC dates: a void
  // period midday their time fell outside the old 9am/noon/3pm UTC samples,
  // so today's VoC never showed while future ones did.
  const tzOffsetMin = Number.isFinite(parseInt((req.query.tz as string) ?? "", 10))
    ? parseInt((req.query.tz as string), 10)
    : 0;
  const now = new Date();

  // Start from the viewer's local midnight (as a UTC instant).
  const shifted = new Date(now.getTime() - tzOffsetMin * 60000);
  const todayUtc = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + tzOffsetMin * 60000
    - backDays * 86400000,
  );

  const DAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

  const days: Array<{
    date: string;
    label: string;
    dayRuler: string;
    moonSign: string;
    moonPhase: string;
    moonFraction: number;
    element: string;
    voidPeriods: boolean;
    quality: string;
    qualityScore: number;
    bestFor: string[];
    tone: string;
    crossings: Array<{ planet: string; angle: string; time: string; at?: string; type: string }>;
    moonAspects: Array<{ planet: string; aspect: string; applying: boolean; orb: number }>;
    tide: ReturnType<typeof computeTide>;
    /** The lunar cycle's own instruction for this day — NOT a quality score.
     *  Six phases of a making cycle, so a waning day reads "consolidate"
     *  rather than "less". */
    approach: string;
    /** Non-lunar configurations tight enough to shape the day. This is the
     *  layer the week chart never showed: the reason a "low" week can still
     *  be a demanding one. */
    weather: Array<{ label: string; planets: [string, string]; aspect: string; orb: number; hard: boolean }>;
    /** 0..1 — how much structural pressure the non-lunar weather carries. */
    pressure: number;
  }> = [];

  for (let d = 0; d < numDays; d++) {
    const dayMs   = todayUtc.getTime() + d * 86400000; // viewer-local midnight, as a UTC instant
    const noonJd  = julianDay(new Date(dayMs + 12 * 3600000)); // viewer-local noon

    const { name: phaseName, fraction } = moonPhase(noonJd);
    const planetsNoon = getPlanetPositions(noonJd);
    const moonSignNoon = planetsNoon.find((p) => p.planet === "Moon")!.sign;
    const elemNoon  = getDailyElementEmphasis(noonJd);

    // Sample the waking span of the viewer's local day for VOC presence. The
    // day-level badge means "a meaningful stretch of this day is void" — at
    // least ~3 waking hours (2 of 6 samples) — not "the Moon is void for five
    // minutes at some point," which is true of more than half of all days and
    // would make the badge noise.
    const vocSamples = [6, 9, 12, 15, 18, 21].filter(
      (h) => voidOfCourse(julianDay(new Date(dayMs + h * 3600000))).voc,
    ).length;
    const hasVoc = vocSamples >= 2 || elemNoon.voidOfCourse;

    // Best-for list
    const element = elemNoon.element;
    const hourFamily = element === "spirit" ? "moon" :
      element === "fire" ? "mars" :
      element === "earth" ? "saturn" :
      element === "air" ? "mercury" : "moon";
    const bestFor = (PLANETARY_HOUR_RULES[hourFamily.charAt(0).toUpperCase() + hourFamily.slice(1)]?.supports ?? []).slice(0, 4);

    const retrogrades = planetsNoon.filter((p) => p.retrograde).length;
    let score = 5;
    if (hasVoc) score -= 1;
    if (retrogrades >= 2) score -= 1;
    if (element === "fire" || element === "air") score += 1;

    const qualityLabel =
      score >= 7 ? "excellent" :
      score >= 5 ? "good" :
      score >= 2 ? "workable" : "mixed";

    // Moon aspects at noon (used for tide trend/coherence)
    const noonMoonAspects = getMajorAspects(noonJd).filter(a => a.planet1 === "Moon" || a.planet2 === "Moon");
    const noonHour = getPlanetaryHour(new Date(dayMs + 12 * 3600000), lat, lon);
    const dayTide = computeTide({
      moonSign: moonSignNoon,
      illumination: fraction,
      phaseName: phaseName,
      voc: hasVoc,
      moonAspects: noonMoonAspects.map((a): TideAspectLite => ({ nature: a.nature, applying: a.applying, orb: a.orb })),
      angularCount: 0,
      hourElement: PLANET_TO_ELEMENT[noonHour.ruler] ?? "air",
    });

    // Angular crossings for this day — significant planets at ASC/MC only
    const dayStartJd = julianDay(new Date(dayMs));
    const rawCrossings = getNextAngularCrossings(dayStartJd, lat, lon, 40, 24)
      .filter(c => {
        if (c.planet === "Moon") return true;
        if ((c.benefic || c.malefic) && (c.angle === "ASC" || c.angle === "MC")) return true;
        if (c.planet === "Sun" && c.angle === "MC") return true;
        return false;
      });
    const crossings = rawCrossings.map((c) => {
      const ct = new Date(c.crossingTime);
      // time is a UTC fallback; client re-derives it from `at` in its own timezone.
      const hh = String(ct.getUTCHours()).padStart(2, "0");
      const mm = String(ct.getUTCMinutes()).padStart(2, "0");
      return {
        planet: c.planet,
        angle:  c.angle,
        time:   `${hh}:${mm}`,
        at:     ct.toISOString(),
        type:   c.benefic ? "benefic" : c.malefic ? "malefic" : "neutral",
      };
    });

    // Moon aspects active at noon
    const noonAspects = getMajorAspects(noonJd)
      .filter(a => a.planet1 === "Moon" || a.planet2 === "Moon")
      .slice(0, 3)
      .map(a => ({
        planet: a.planet1 === "Moon" ? a.planet2 : a.planet1,
        aspect: a.aspect,
        applying: a.applying,
        orb: parseFloat(a.orb.toFixed(1)),
      }));

    // Recover the viewer-local calendar date/weekday from the (UTC) local-midnight instant.
    const localDay = new Date(dayMs - tzOffsetMin * 60000);
    // ── The lunar cycle as an INSTRUCTION, not an amount ──────────────────
    // The week chart's failure was ontological: it drew one bar whose height
    // mixed lunar fullness with aspect activity, so a waning week rendered as
    // an empty one. Phase does not measure how much is available — it says
    // what part of a making cycle you are in. Named accordingly.
    const APPROACH_BY_PHASE: Record<string, string> = {
      "New Moon": "initiate",
      "Waxing Crescent": "build",
      "First Quarter": "build",
      "Waxing Gibbous": "refine",
      "Full Moon": "release",
      "Waning Gibbous": "consolidate",
      "Last Quarter": "consolidate",
      "Waning Crescent": "recover",
      "Balsamic": "recover",
    };
    const approach = APPROACH_BY_PHASE[phaseName] ?? "build";

    // ── Significant weather — the non-lunar layer, encoded separately ──────
    // Tight planet-to-planet configurations. Deliberately its own channel
    // rather than another term in the height, because aspect activity and
    // lunar fullness are not alternate measurements of the same substance.
    const HARD_ASP = new Set(["conjunction", "square", "opposition"]);
    const weather = getMajorAspects(noonJd)
      .filter((a) => a.planet1 !== "Moon" && a.planet2 !== "Moon" && a.orb <= 1.5)
      .slice(0, 4)
      .map((a) => ({
        label: `${a.planet1} ${a.aspect} ${a.planet2}`,
        planets: [a.planet1, a.planet2] as [string, string],
        aspect: a.aspect,
        orb: parseFloat(a.orb.toFixed(2)),
        hard: HARD_ASP.has(a.aspect),
      }));
    // Pressure counts the HARD ones and how exact they are — a tight square
    // between slow bodies is the thing that makes a quiet-looking week heavy.
    const pressure = Math.min(1, weather
      .filter((w) => w.hard)
      .reduce((acc, w) => acc + (1 - w.orb / 1.5) * 0.5, 0));

    days.push({
      date:         localDay.toISOString().split("T")[0],
      label:        DAY_LABELS[localDay.getUTCDay()],
      dayRuler:     DAY_RULERS[localDay.getUTCDay()],
      moonSign:     moonSignNoon,
      moonPhase:    phaseName,
      moonFraction: fraction,
      element,
      voidPeriods:  hasVoc,
      quality:      qualityLabel,
      qualityScore: score,
      bestFor,
      tone: WEEK_ELEMENT_TONES[element] ?? WEEK_ELEMENT_TONES.water,
      crossings,
      moonAspects: noonAspects,
      tide: dayTide,
      approach,
      weather,
      pressure: parseFloat(pressure.toFixed(2)),
    });
  }

  // Dominant element of the week (most frequent)
  const elCounts: Record<string, number> = {};
  days.forEach((d) => { elCounts[d.element] = (elCounts[d.element] ?? 0) + 1; });
  const weekEl = Object.entries(elCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "water";

  // The week's tone used to be derived from its dominant ELEMENT alone, which
  // put it straight into contradiction with the new per-day approach labels:
  // a week of "consolidate" days was being summarised as "An active week.
  // Energy is available for initiation" because its Moon signs leaned fire.
  // Element says what KIND of day; the lunar cycle says what part of the making
  // cycle you are in. The summary now leads with the second, because that is
  // what the bars beneath it are drawing.
  const APPROACH_TONE: Record<string, string> = {
    initiate:    "A seeding week — the cycle restarts. Good for beginnings that don't need an audience yet.",
    build:       "A building week. Momentum's there; put it into what you've already started.",
    refine:      "A refining week. The shape exists — this is for adjusting it, not adding to it.",
    consolidate: "A consolidating week. Less about starting than making what's there hold.",
    release:     "A releasing week. Things come to a head and complete; let them go out.",
    recover:     "A recovering week. The cycle's emptying out. Rest is the work.",
  };
  const apCounts: Record<string, number> = {};
  days.forEach((d) => { apCounts[d.approach] = (apCounts[d.approach] ?? 0) + 1; });
  const weekApproach = Object.entries(apCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "build";

  // A month is not a long week. Over ~29 days the Moon passes through every
  // phase and every sign, so BOTH "the dominant approach" and "leaning fire"
  // become artifacts of where the window happens to start rather than facts
  // about the span. Naming the turning points is the only honest summary at
  // that length — so the month view gets its own sentence.
  const isMonth = days.length > 10;
  const turns: string[] = [];
  if (isMonth) {
    for (let i = 1; i < days.length - 1; i++) {
      const [prev, cur, next] = [days[i - 1], days[i], days[i + 1]];
      const [, mo, da] = cur.date.split("-");
      const when = `${MONTH_ABBR[Number(mo) - 1]} ${Number(da)}`;
      // Local extremum of illumination — the new and full Moons, found from
      // the same fraction the bars are drawn from rather than recomputed.
      if (cur.moonFraction <= prev.moonFraction && cur.moonFraction <= next.moonFraction && cur.moonFraction < 0.06)
        turns.push(`new Moon ${when}`);
      if (cur.moonFraction >= prev.moonFraction && cur.moonFraction >= next.moonFraction && cur.moonFraction > 0.94)
        turns.push(`full Moon ${when}`);
    }
  }

  // Structural pressure is reported SEPARATELY rather than blended into the
  // tone — a consolidating week with a heavy midweek is both of those things,
  // and averaging them into one adjective is what produced the misleading
  // single bar in the first place.
  //
  // Naming the heavy days needs two different vocabularies. Inside one week
  // "Tue" is unambiguous; across a month it is not — the first draft produced
  // "pressure around Mon, Sat, Mon, Fri, Thu, Fri, Tue", where the two Mondays
  // are different days and the reader has no way to tell which. So a span
  // longer than a week names dates, and either way the list is capped: a
  // summary that lists seven days has stopped summarising.
  const heavy = days.filter((d) => d.pressure >= 0.4);
  const asWeek = days.length <= 7;
  const nameOf = (d: (typeof days)[number]) => {
    if (asWeek) return d.label.slice(0, 3);
    const [, mo, da] = d.date.split("-");
    return `${MONTH_ABBR[Number(mo) - 1]} ${Number(da)}`;
  };
  let pressureNote = "";
  if (heavy.length) {
    // Pick the three HEAVIEST, then say them in time order. Slicing
    // chronologically named whichever heavy days came first and pushed the
    // rest into "and 4 more" — which on a real month hid the heaviest day of
    // the span behind a count. Which days matter is a question about pressure;
    // what order to say them in is a question about planning.
    const named = heavy
      .slice()
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 3)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(nameOf);
    const rest = heavy.length - named.length;
    const list = named.join(", ") + (rest > 0 ? `, and ${rest} more` : "");
    pressureNote = ` Structural pressure ${heavy.length === 1 ? "on" : "around"} ${list}.`;
  }
  const weekTone = isMonth
    ? (turns.length
        ? `The cycle turns at ${turns.join(" and ")}.`
        : "A stretch of one lunar cycle.") + pressureNote
    // Element is reported only for the week, where the Moon holds two or three
    // signs and "leaning fire" says something. Across a month it says nothing.
    : (APPROACH_TONE[weekApproach] ?? "") + pressureNote + ` Leaning ${weekEl}.`;

  res.json({ weekOf: days[0]?.date, days, weekTone, weekElement: weekEl, weekApproach });
});

// ── /api/tides/best-times ───────────────────────────────────────────────────
// "When should I work out / study / rest this week?" — scans a lens curve across
// the next N days and returns the highest-energy windows for that lens.

const BEST_TIMES_LABEL: Record<string, string> = {
  overall: "a resonant window",
  fire: "bold moves — start, train, perform",
  earth: "building & finishing — craft, tend, complete",
  air: "words & connection — write, meet, learn",
  water: "feeling & rest — heal, dream, restore",
};

/**
 * GET /tides/elemental-peaks — when each ELEMENT's tide runs highest.
 *
 * Renamed from `/tides/best-times`, which was a claim it could not support.
 * This route takes a `lens` — fire, earth, air, water — and never an activity.
 * It answers "when is the fire tide highest this week", which is a real
 * question and a different one from "when should I do this work". The old name
 * let a client render "Best this week for X" from an elemental curve, putting
 * activity-level authority on a route that has never seen an activity.
 *
 * Activity timing is `evaluateActivityInterval` / `/elections/times`. Nothing
 * here should be used to answer it.
 */
/**
 * GET /tides/planetary-hours?dates=YYYY-MM-DD,…&lat&lon
 *
 * One source of truth for the hour grid. Calendar reimplemented the Chaldean
 * sequence and its own solar geometry client-side, and a local copy of a shared
 * astronomical fact diverges eventually even when both start correct — this one
 * already had: the client returned null above the polar circles while the
 * server fabricated a symmetric twelve-hour day, so for a few weeks the two
 * disagreed about whether Tromsø had hours at all.
 *
 * `hours: null` for a date means genuinely unavailable — polar day or night,
 * where there is no daylight span to divide into twelve. Withheld rather than
 * captioned, the same as when the location is a guess.
 */
router.get("/tides/planetary-hours", (req, res) => {
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  // getTimezoneOffset() convention: minutes to ADD to local to reach UTC.
  const tzOffsetMin = Number.isFinite(parseInt((req.query.tz as string) ?? "", 10))
    ? parseInt((req.query.tz as string), 10) : 0;
  const dates = String(req.query.dates ?? "").split(",").filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 14);
  if (!dates.length) { res.status(400).json({ error: "dates required" }); return; }

  const out: Record<string, { ruler: string; startAt: string; endAt: string; isDayHour: boolean; hourNumber: number }[] | null> = {};
  for (const d of dates) {
    const [y, m, day] = d.split("-").map(Number);
    const noon = new Date(Date.UTC(y, m - 1, day, 12, 0, 0) + tzOffsetMin * 60000);
    if (getSunriseSunset(julianDay(noon), lat, lon).polar) { out[d] = null; continue; }
    const hours: typeof out[string] = [];
    // Walk the local day. Bounded by the guard rather than by an assumed count:
    // hour LENGTH varies with season and latitude, so the number spanning a
    // civil day is not a constant to hard-code.
    // The VIEWER's day, not the server's. Walking from UTC midnight returns
    // Aug 4 19:00 -> Aug 5 19:00 local for Austin, while the client keys this
    // map by its own local date string — every band displaced by the offset.
    // That is the exact bug the old client/server agreement test existed to
    // catch ("anchors to UTC midnight, not local midnight"), reintroduced on
    // the server side while removing it from the client.
    let cursor = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) + tzOffsetMin * 60000);
    const end = new Date(cursor.getTime() + 86400000);
    let guard = 0;
    while (cursor < end && guard++ < 40) {
      const h = getPlanetaryHour(cursor, lat, lon);
      if (!h?.endTime) break;
      hours.push({
        ruler: h.ruler,
        startAt: h.startTime.toISOString(),
        endAt: h.endTime.toISOString(),
        isDayHour: h.isDayHour,
        hourNumber: h.hourNumber,
      });
      cursor = new Date(h.endTime.getTime() + 1000);
    }
    out[d] = hours;
  }
  res.json({ hours: out });
});

router.get("/tides/elemental-peaks", (req, res) => {
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const lens = (req.query.lens as string) ?? "overall";
  const days = Math.min(14, Math.max(1, parseInt((req.query.days as string) ?? "7", 10)));
  const topPerDay = Math.max(1, Math.min(3, parseInt((req.query.perDay as string) ?? "1", 10)));
  // Viewer's tz offset (Date.getTimezoneOffset convention). Without this the day
  // range and each day's "date" label were computed on the server's calendar day
  // (UTC on Railway), which could disagree with the viewer's actual day — the
  // same class of bug fixed for /tides/now's day-arc.
  const tzOffsetMin = Number.isFinite(parseInt((req.query.tz as string) ?? "", 10))
    ? parseInt((req.query.tz as string), 10)
    : 0;

  const nowInstant = new Date();
  const results: Array<{ date: string; startClock: string; endClock: string; startAt: string; endAt: string; peakE: number; label: string }> = [];

  for (let d = 0; d < days; d++) {
    const arc = computeDayArc(new Date(nowInstant.getTime() + d * 86400000), lat, lon, tzOffsetMin);
    const curve = arc.curves[lens] ?? arc.curve;
    const peaks = findPeakWindows(curve, topPerDay, 3);
    const dayStartMs = new Date(arc.dayStart).getTime();
    // Recover the viewer-local calendar date from the (UTC) dayStart instant.
    const localDate = new Date(dayStartMs - tzOffsetMin * 60000).toISOString().slice(0, 10);
    for (const p of peaks) {
      const start = new Date(dayStartMs + p.startHour * 3600000);
      const end = new Date(dayStartMs + p.endHour * 3600000);
      results.push({
        date: localDate,
        startClock: clockLocal(start, tzOffsetMin),
        endClock: clockLocal(end, tzOffsetMin),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        peakE: parseFloat(p.peakE.toFixed(3)),
        label: BEST_TIMES_LABEL[lens] ?? "a good window",
      });
    }
  }

  results.sort((a, b) => b.peakE - a.peakE);
  res.json({ lens, days, windows: results.slice(0, 8) });
});

// ── /api/tides/windows ─────────────────────────────────────────────────────

router.get("/tides/windows", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  const hours = Math.min(parseInt((req.query.hours as string) ?? "12"), 24);
  const now   = new Date();

  const windows: Array<{
    startTime: string;
    endTime: string;
    element: string;
    voidOfCourse: boolean;
    planetaryHour: string;
    quality: string;
  }> = [];

  // Walk actual planetary hour boundaries
  const seen = new Set<string>();
  let cursor = new Date(now.getTime());
  const windowEnd = new Date(now.getTime() + hours * 3600000);

  while (cursor < windowEnd && windows.length < 12) {
    const planHour = getPlanetaryHour(cursor, lat, lon);
    const key = planHour.startTime.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      const mid = new Date((planHour.startTime.getTime() + planHour.endTime.getTime()) / 2);
      const jd = julianDay(mid);
      const { voc } = voidOfCourse(jd);
      const elemEmph = getDailyElementEmphasis(jd);
      const planets  = getPlanetPositions(jd);
      const retrogrades = planets.filter((p) => p.retrograde).length;

      let score = 5;
      if (voc) score -= 2;
      if (retrogrades >= 2) score -= 1;
      if (elemEmph.element === "fire" || elemEmph.element === "air") score += 1;

      const qualityLabel =
        score >= 8 ? "excellent" :
        score >= 5 ? "good" :
        score >= 2 ? "workable" :
        score >= -1 ? "mixed" : "avoid_if_possible";

      windows.push({
        startTime:    planHour.startTime.toISOString(),
        endTime:      planHour.endTime.toISOString(),
        element:      elemEmph.element,
        voidOfCourse: voc,
        planetaryHour: planHour.ruler,
        quality:      qualityLabel,
      });
    }
    cursor = new Date(planHour.endTime.getTime() + 60000);
  }

  res.json({ windows });
});

// ── /api/tides/practices ───────────────────────────────────────────────────
// Returns active cultivations sorted and annotated by how well they match
// the current timing weather.

import { cultivations, cultivationCheckIns } from "@workspace/db";
import { and } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

// Moon phase name → quadrant
function phaseQuadrant(phaseName: string): string {
  if (phaseName.includes("New"))    return "new";
  if (phaseName.includes("Waxing")) return "waxing";
  if (phaseName.includes("Full"))   return "full";
  return "waning";
}

const MATCH_LABELS: Record<string, string> = {
  resonant:  "resonant",
  supported: "supported",
  neutral:   "neutral",
  soften:    "soften",
  protect:   "protect the minimum",
};

router.get("/tides/practices", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");

  const date = new Date();
  const jd   = julianDay(date);

  // Current timing snapshot
  const planets      = getPlanetPositions(jd);
  const { name: moonPhaseName } = moonPhase(jd);
  const elemEmph     = getDailyElementEmphasis(jd);
  const planHour     = getPlanetaryHour(date, lat, lon);
  const retrogrades  = new Set(planets.filter((p) => p.retrograde).map((p) => p.planet));
  const aspects      = getMajorAspects(jd);
  const moonAspects  = aspects.filter((a) => a.planet1 === "Moon" || a.planet2 === "Moon");
  const { voc }      = voidOfCourse(jd);
  const phase        = phaseQuadrant(moonPhaseName);

  // Moon's applying aspects to benefics/malefics
  const moonApplyingTo = new Set(
    moonAspects
      .filter((a) => a.applying)
      .map((a) => (a.planet1 === "Moon" ? a.planet2 : a.planet1)),
  );

  // Active cultivations + today's check-ins
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(cultivations)
    .where(and(eq(cultivations.testerId, testerId), eq(cultivations.status, "active")));

  const todayCheckIns = await db
    .select()
    .from(cultivationCheckIns)
    .where(and(eq(cultivationCheckIns.testerId, testerId), eq(cultivationCheckIns.date, today)));
  const ciMap = new Map(todayCheckIns.map((ci) => [ci.cultivationId, ci]));

  const scored = rows.map((c) => {
    const favored  = (c.favoredPlanets as string[] | null) ?? [];
    const cautions = (c.cautionPlanets as string[] | null) ?? [];
    const phases   = (c.favoredPhases  as string[] | null) ?? [];
    const cElems   = (c.elements       as string[] | null) ?? (c.element ? [c.element] : []);

    let score = 0;

    // Element match
    if (cElems.includes(elemEmph.element)) score += 3;
    else if (!voc && elemEmph.element !== "spirit") score += 0;

    // Planetary hour match
    if (favored.includes(planHour.ruler)) score += 2;

    // Favored planet currently active (not retrograde, applying Moon aspect)
    for (const fp of favored) {
      if (moonApplyingTo.has(fp)) score += 1;
      if (retrogrades.has(fp))    score -= 1;
    }

    // Caution planet applying Moon aspect or in exact transit
    for (const cp of cautions) {
      if (moonApplyingTo.has(cp)) score -= 2;
      if (retrogrades.has(cp))    score -= 1;
    }

    // Moon phase match
    if (phases.includes(phase)) score += 1;

    // VOC: pull everything toward Spirit/rest work
    if (voc) {
      const isRestPractice = cElems.includes("spirit") || cElems.includes("water");
      score += isRestPractice ? 2 : -2;
    }

    // Classify
    const match =
      score >= 5 ? "resonant" :
      score >= 2 ? "supported" :
      score >= 0 ? "neutral" :
      score >= -2 ? "soften" : "protect";

    // One-line recommendation
    let recommendation = "";
    if (match === "resonant") {
      recommendation = voc
        ? "Favored even in this void window — gentle practice supported."
        : `Good timing. The ${elemEmph.element} field and ${planHour.ruler} hour support this practice.`;
    } else if (match === "supported") {
      recommendation = `Supported. ${planHour.ruler} hour is aligned; settle in and tend this.`;
    } else if (match === "neutral") {
      recommendation = "Neutral timing. Tend it from habit and rhythm rather than momentum.";
    } else if (match === "soften") {
      const reasonParts: string[] = [];
      if (voc) reasonParts.push("Moon is void");
      for (const cp of cautions) {
        if (moonApplyingTo.has(cp)) reasonParts.push(`Moon applying to ${cp}`);
        if (retrogrades.has(cp))    reasonParts.push(`${cp} retrograde`);
      }
      recommendation = `Consider softening today. ${reasonParts.join("; ") || "Timing is less favorable"}. ${c.minimumViable ? `Minimum viable: ${c.minimumViable}.` : ""}`;
    } else {
      recommendation = `Protect the minimum. ${c.minimumViable ?? "Rest if needed — this practice can wait."}`;
    }

    // The wire names are the client's ScoredPractice contract — `name`,
    // `timing`, `reasons` (lib/types.ts:173). This route had been answering
    // `title`, `match` and `recommendation`, so every consumer read `p.timing`
    // as undefined: no practice ever classified as resonant, and the fit label
    // rendered blank. The declared type was always right; the server never
    // honored it. Nothing reads the old names, so they are gone rather than
    // doubled up. (Ported from the stalled practices worktree, 2026-08-15.)
    return {
      ...c,
      name: c.title,
      score,
      timing: match,
      reasons: [recommendation],
      todayCheckIn: ciMap.get(c.id) ?? null,
    };
  });

  // Sort: resonant → supported → neutral → soften → protect
  const ORDER = ["resonant", "supported", "neutral", "soften", "protect"];
  scored.sort((a, b) => ORDER.indexOf(a.timing) - ORDER.indexOf(b.timing));

  res.json({
    asOf: date.toISOString(),
    timing: {
      element: elemEmph.element,
      voidOfCourse: voc,
      moonPhase: moonPhaseName,
      phase,
      planetaryHourRuler: planHour.ruler,
      retrogrades: [...retrogrades],
    },
    practices: scored,
  });
});

// ── /api/tides/crossings ───────────────────────────────────────────────────

const CROSSING_INTERPRETATIONS: Record<string, Record<string, string>> = {
  Venus:   { ASC: "grace and ease on the surface — good for connection, presentation, relational work", MC: "favor for visibility, creative expression, public-facing work", DSC: "relational warmth, receptivity, partnership", IC: "beauty and ease in private rhythm, home, or self-care" },
  Jupiter: { ASC: "expansion, confidence, and good fortune in new beginnings", MC: "favorable moment for outreach, teaching, publishing, or making your work visible", DSC: "generosity in relationship, good for collaborative work", IC: "expansive groundedness — good for rooting something new" },
  Mars:    { ASC: "high energy, drive, and initiative — but watch for impulsiveness", MC: "strong will and ambition activated — good for decisive action, less for diplomacy", DSC: "relational friction or strong desire energy", IC: "inner drive; can be restless energy needing grounding" },
  Saturn:  { ASC: "seriousness, structure, patience called for — slow down and commit", MC: "accountability, discipline, long-term building — not the moment for shortcuts", DSC: "testing of relationship structures; commitment or contraction", IC: "grounding in foundation work, but possible heaviness or restriction" },
  Mercury: { ASC: "mental clarity, expressiveness, good for communication and quick decisions", MC: "good for negotiation, writing, or any work requiring sharp thinking", DSC: "attentive listening, good for dialogue", IC: "sorting through inner narrative or private logistics" },
  Sun:     { ASC: "vitality and self-expression amplified — be seen", MC: "solar moment for leadership, clarity, and forward-facing work", DSC: "warmth in partnership; others see you clearly now", IC: "inner radiance; restore and self-nourish" },
  Moon:    { ASC: "emotional sensitivity heightened — receptive and intuitive", MC: "public emotional intelligence; good for care-forward visibility", DSC: "attunement in relationship, emotional resonance", IC: "deep rest, home, self-care, inner work" },
};

router.get("/tides/crossings", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  const hours = Math.min(parseFloat((req.query.hours as string) ?? "24"), 48);
  const date  = new Date();
  const jd    = julianDay(date);

  const crossings = getNextAngularCrossings(jd, lat, lon, 3, hours);

  const annotated = crossings.map((c) => ({
    ...c,
    interpretation: CROSSING_INTERPRETATIONS[c.planet]?.[c.angle]
      ?? `${c.planet} contacts the ${c.angle} — themes of ${c.planet.toLowerCase()} activated at this angle`,
  }));

  res.json({ asOf: date.toISOString(), crossings: annotated });
});

// ── /api/tides/events ─────────────────────────────────────────────────────
// Scan forward N days and surface notable sky events: moon phases, ingresses,
// VOC windows, angular crossings, and high-quality day windows.

router.get("/tides/events", (req, res) => {
  const lat    = parseFloat((req.query.lat as string) ?? "40.7");
  const lon    = parseFloat((req.query.lon as string) ?? "-74.0");
  const numDays = Math.min(parseInt((req.query.days as string) ?? "30"), 60);
  const now    = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  type SkyEvent = {
    date: string;
    time?: string;
    at?: string;        // ISO UTC instant for timed events — client formats to its own timezone
    type: "moon_phase" | "ingress" | "voc" | "crossing" | "quality_window";
    title: string;
    subtitle?: string;
    icon: string;
    quality: "favorable" | "caution" | "neutral";
  };

  const events: SkyEvent[] = [];

  // Crossings: benefic/malefic at ASC/MC, Moon at all angles.
  //
  // RESOLVED 2026-08-13. This route was measured at 13.2s for 7 days, 42.2s
  // for 30, and >90s for the 90 days Calendar requests on load; being
  // synchronous, it blocked Node for the duration and every other request
  // queued behind it, which is why a calendar holding real windows rendered
  // empty. Now 0.20s / 0.38s / 0.73s.
  //
  // The cost was NOT this crossings scan — gating it behind a flag moved
  // nothing (99.0s off vs 97.7s on). It was getMajorAspects called once per
  // hour in the Moon-aspect loop below, each call running a 14-day station
  // sweep whose momentum fields that loop then discarded. getAspectOrbs is
  // the cheap half. Leaving the wrong suspect named here on purpose: the
  // measurement that cleared it is the reason to measure rather than re-guess.
  const startJd = julianDay(now);
  const significantCrossings = getNextAngularCrossings(startJd, lat, lon, 80, numDays * 24)
    .filter(c => {
      if (c.planet === "Moon") return true;
      if ((c.benefic || c.malefic) && (c.angle === "ASC" || c.angle === "MC")) return true;
      if (c.planet === "Sun" && c.angle === "MC") return true;
      return false;
    });
  const crossings = significantCrossings;
  for (const c of crossings) {
    const crossTime = new Date(c.crossingTime);
    // date/time are UTC fallbacks; the client re-derives both from `at` in its own tz.
    const dateStr = crossTime.toISOString().split("T")[0];
    const timeStr = crossTime.toISOString().slice(11, 16);
    const isBenefic = c.benefic;
    const isMalefic = c.malefic;
    events.push({
      date: dateStr,
      time: timeStr,
      at: crossTime.toISOString(),
      type: "crossing",
      title: `${c.planet} crosses ${c.angle}`,
      subtitle: CROSSING_INTERPRETATIONS[c.planet]?.[c.angle],
      icon: isBenefic ? "✦" : isMalefic ? "⚡" : "◈",
      quality: isBenefic ? "favorable" : isMalefic ? "caution" : "neutral",
    });
  }

  // ── Moon aspects: scan hourly for applying→separating transitions ──
  {
    const CLASSICAL = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
    const ASPECT_ICONS: Record<string, string> = {
      conjunction:"☌", trine:"△", sextile:"⚹", square:"□", opposition:"☍",
    };
    const ASPECT_QUALITY: Record<string, "favorable"|"caution"|"neutral"> = {
      trine:"favorable", sextile:"favorable", conjunction:"neutral", square:"caution", opposition:"caution",
    };
    // Track per-pair previous orb to find minimum (exact moment)
    const prevOrb: Record<string, number> = {};

    for (let h = 0; h <= numDays * 24; h++) {
      const scanJd = startJd + h / 24;
      // THE ROUTE'S REAL COST WAS HERE. This ran getMajorAspects once per
      // HOUR — 2,160 calls across ninety days, each performing its own
      // fourteen-day station sweep, so roughly a hundred and twenty thousand
      // ephemeris evaluations for one request. Like the day-resolution scan
      // below, it tracks orbs itself and reads nothing but `orb`, so the
      // station-aware half was pure waste.
      const aspects = getAspectOrbs(scanJd);

      for (const asp of aspects) {
        if (asp.planet1 !== "Moon" && asp.planet2 !== "Moon") continue;
        const other = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1;
        if (!CLASSICAL.includes(other)) continue;

        const key = `${other}:${asp.aspect}`;
        const prev = prevOrb[key];

        // Exact moment: orb was decreasing (applying) and now starts increasing
        if (prev !== undefined && asp.orb > prev && prev < 1.5) {
          const exactDate = new Date((startJd + (h - 0.5) / 24 - 2440587.5) * 86400000);
          const dateStr = exactDate.toISOString().split("T")[0];
          const timeStr = exactDate.toISOString().slice(11, 16);
          const sym = ASPECT_ICONS[asp.aspect] ?? asp.aspect;
          events.push({
            date: dateStr,
            time: timeStr,
            at: exactDate.toISOString(),
            type: "moon_aspect" as any,
            title: `Moon ${sym} ${other}`,
            subtitle: `${asp.nature} — ${asp.orb.toFixed(1)}° orb`,
            icon: sym,
            quality: ASPECT_QUALITY[asp.aspect] ?? "neutral",
          });
          delete prevOrb[key]; // reset until next aspect window
        } else {
          prevOrb[key] = asp.orb;
        }
      }
    }
  }

  // ── Planet-planet aspects: day-resolution scan for perfection days ──
  // Slow pairs change orb slowly, so daily sampling finds the exact day
  // reliably. These are the "Sun □ Saturn exact" landmarks the calendar
  // should lead with alongside the lunar stream.
  {
    const ASPECT_ICONS: Record<string, string> = {
      conjunction:"☌", trine:"△", sextile:"⚹", square:"□", opposition:"☍",
    };
    const ASPECT_QUALITY: Record<string, "favorable"|"caution"|"neutral"> = {
      trine:"favorable", sextile:"favorable", conjunction:"neutral", square:"caution", opposition:"caution",
    };
    const prevOrbPP: Record<string, number> = {};
    for (let d = 0; d <= numDays; d++) {
      const scanJd = startJd + d;
      // Orb-only: this loop tracks orbs across days and decides perfection
      // itself, so it never used getMajorAspects' station-aware momentum
      // fields — it just paid for them, fifty-six position computations per
      // day, ninety times.
      for (const asp of getAspectOrbs(scanJd)) {
        if (asp.planet1 === "Moon" || asp.planet2 === "Moon") continue;
        const key = `${asp.planet1}:${asp.planet2}:${asp.aspect}`;
        const prev = prevOrbPP[key];
        // Perfection: orb was shrinking, now grows, and got tight enough to matter.
        if (prev !== undefined && asp.orb > prev && prev < 1.2) {
          const exactDate = new Date((scanJd - 0.5 - 2440587.5) * 86400000);
          const sym = ASPECT_ICONS[asp.aspect] ?? "·";
          events.push({
            date: exactDate.toISOString().split("T")[0],
            at: exactDate.toISOString(),
            type: "aspect" as any,
            title: `${asp.planet1} ${sym} ${asp.planet2}`,
            subtitle: `${asp.nature} — exact around this day`,
            icon: sym,
            quality: ASPECT_QUALITY[asp.aspect] ?? "neutral",
          });
          delete prevOrbPP[key];
        } else {
          prevOrbPP[key] = asp.orb;
        }
      }
    }
  }

  // Scan day-by-day for phase changes, ingresses, VOC, quality windows
  let prevPhase = "";
  let prevSign  = "";

  for (let d = 0; d < numDays; d++) {
    const dayMs   = todayUtc.getTime() + d * 86400000;
    const dayDate = new Date(dayMs);
    const dateStr = dayDate.toISOString().split("T")[0];
    const noonJd  = julianDay(new Date(dayMs + 12 * 3600000));

    const { name: phaseName } = moonPhase(noonJd);
    const planetsNoon  = getPlanetPositions(noonJd);
    const moonSignNoon = planetsNoon.find((p) => p.planet === "Moon")!.sign;
    const elemNoon     = getDailyElementEmphasis(noonJd);
    const retrogrades  = planetsNoon.filter((p) => p.retrograde).length;

    const amJd  = julianDay(new Date(dayMs + 9  * 3600000));
    const pmJd  = julianDay(new Date(dayMs + 15 * 3600000));
    const amVoc = voidOfCourse(amJd).voc;
    const pmVoc = voidOfCourse(pmJd).voc;
    const hasVoc = amVoc || pmVoc;

    // Moon phase event when phase name changes
    if (phaseName !== prevPhase && d > 0) {
      const isNewMoon  = phaseName.includes("New");
      const isFullMoon = phaseName.includes("Full");
      const isQuarter  = phaseName.includes("Quarter");
      if (isNewMoon || isFullMoon || isQuarter) {
        events.push({
          date:    dateStr,
          type:    "moon_phase",
          title:   phaseName.replace(/_/g, " "),
          subtitle: isNewMoon
            ? "Clean slate energy — good for setting intentions."
            : isFullMoon
            ? "Peak illumination — completion and release."
            : "Turning point — adjust course.",
          icon:    isNewMoon ? "🌑" : isFullMoon ? "🌕" : "🌓",
          quality: isFullMoon ? "caution" : "favorable",
        });
      }
    }
    prevPhase = phaseName;

    // Moon sign ingress
    if (moonSignNoon !== prevSign && d > 0) {
      const elemOfSign: Record<string, string> = {
        Aries:"fire",Leo:"fire",Sagittarius:"fire",
        Taurus:"earth",Virgo:"earth",Capricorn:"earth",
        Gemini:"air",Libra:"air",Aquarius:"air",
        Cancer:"water",Scorpio:"water",Pisces:"water",
      };
      const signElem = elemOfSign[moonSignNoon] ?? "water";
      events.push({
        date:    dateStr,
        type:    "ingress",
        title:   `Moon enters ${moonSignNoon}`,
        subtitle: WEEK_ELEMENT_TONES[signElem]?.split(".")[0] ?? "",
        icon:    "☽",
        quality: "neutral",
      });
    }
    prevSign = moonSignNoon;

    // VOC period — only when it takes up a meaningful chunk of the day
    if (hasVoc) {
      events.push({
        date:    dateStr,
        type:    "voc",
        title:   "Moon void of course",
        subtitle: "Avoid new beginnings. Good for completion, rest, and review.",
        icon:    "◌",
        quality: "caution",
      });
    }

    // High-quality window
    let score = 5;
    if (hasVoc) score -= 1;
    if (retrogrades >= 2) score -= 1;
    if (elemNoon.element === "fire" || elemNoon.element === "air") score += 1;

    if (score >= 6 && !hasVoc) {
      events.push({
        date:    dateStr,
        type:    "quality_window",
        title:   `${elemNoon.element.charAt(0).toUpperCase() + elemNoon.element.slice(1)} day · quality ${score}/7`,
        subtitle: WEEK_ELEMENT_TONES[elemNoon.element]?.split(".")[0],
        icon:    "◉",
        quality: "favorable",
      });
    }
  }

  // Sort by date, then type priority
  const TYPE_ORDER: Record<string, number> = { moon_phase:0, quality_window:1, crossing:2, moon_aspect:3, ingress:4, voc:5 };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  });

  res.json({ asOf: now.toISOString(), events });
});

// The almanac's computation lives in lib/almanac.ts so it can be tested
// against a fixed moment. The route is the transport and nothing else.
router.get("/tides/almanac", (req, res) => {
  const days = Math.min(Math.max(parseInt((req.query.days as string) ?? "45"), 1), 120);
  const now = new Date();
  res.json({ asOf: now.toISOString(), days, entries: buildAlmanac(now, days) });
});

export default router;
