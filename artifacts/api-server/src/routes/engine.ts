/**
 * Compass Engine — the public API for ecosystem consumers (spec:
 * artifacts/tides/ENGINE-API-SPEC.md; capability map: Notion → Ecosystem
 * Build Plan). Thin wrappers over the internal libs — judged data
 * (readings, ranked windows) over raw data, though raw is available.
 *
 * Auth: static bearer tokens, comma-separated in ENGINE_TOKENS. If the env
 * var is unset the engine namespace answers 503 — safe by default, and the
 * app's own /api surface is untouched either way.
 *
 * Consumers (per the ecosystem plan): AstroLyrica + Starweather read
 * /engine/reading; the Hub's electional/due-diligence booking reads
 * /engine/find-time; anything may read the raw layer.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  julianDay, getPlanetPositions, lunarNodes, getAsteroids, moonPhase, voidOfCourse,
  moonFinalAspectInSign, eclipseWindow, getPlanetaryHour, getLocalAngles,
  getAngularPlanets, getNextAngularCrossings,
} from "../lib/astro.js";
import { dayReading, type NatalForReading } from "../lib/synthesis.js";
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";
import { computeElections } from "../lib/electionEngine.js";
import { ACTIVITIES } from "../lib/activityCorrespondences.js";
import { domicileLord } from "../lib/dignity.js";

const router: IRouter = Router();
const ENGINE_VERSION = "0.1";

// ── Auth + version header for the whole /engine namespace ────────────────────
function engineAuth(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Engine-Version", ENGINE_VERSION);
  const tokens = (process.env.ENGINE_TOKENS ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (!tokens.length) { res.status(503).json({ error: "engine not enabled (ENGINE_TOKENS unset)" }); return; }
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!tokens.includes(token)) { res.status(401).json({ error: "invalid engine token" }); return; }
  next();
}
router.use("/engine", engineAuth);

// ── Shared parsing ───────────────────────────────────────────────────────────
function atOf(req: Request): Date | null {
  const raw = req.query.at as string | undefined;
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}
function numQ(req: Request, key: string, dflt: number): number {
  const v = parseFloat(String(req.query[key] ?? ""));
  return Number.isFinite(v) ? v : dflt;
}

/** The canonical ecosystem birth profile (ENGINE-API-SPEC.md). Returns null
 *  (with a reason) on malformed input; absence of a profile is not an error. */
interface BirthProfile { birthDate: string; birthTime?: string; timeKnown?: boolean; lat: number; lon: number; utcOffset: number; }
function parseBirthProfile(body: unknown): { natal: ReturnType<typeof computeNatalChart>; timeKnown: boolean } | { error: string } | null {
  const b = (body ?? {}) as Partial<BirthProfile> & { birthProfile?: Partial<BirthProfile> };
  const p = b.birthProfile ?? b;
  if (p.birthDate == null && p.lat == null) return null; // no profile supplied
  if (!p.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) return { error: "birthDate (YYYY-MM-DD) is required" };
  if (typeof p.lat !== "number" || typeof p.lon !== "number") return { error: "lat and lon (numbers) are required" };
  if (typeof p.utcOffset !== "number") return { error: "utcOffset (hours, number) is required" };
  const timeKnown = p.timeKnown !== false && !!p.birthTime;
  try {
    const natal = computeNatalChart(p.birthDate, p.birthTime || "12:00", p.lat, p.lon, p.utcOffset);
    return { natal, timeKnown };
  } catch (e) {
    return { error: `chart computation failed: ${(e as Error).message}` };
  }
}
function natalForReading(natal: ReturnType<typeof computeNatalChart>, timeKnown: boolean): NatalForReading {
  return {
    planets: natal.planets.map(p => ({ planet: p.planet, longitude: p.longitude })),
    asc: timeKnown ? natal.ascendant.longitude : undefined,
    mc: timeKnown ? natal.midheaven.longitude : undefined,
  };
}

// ── Raw layer ────────────────────────────────────────────────────────────────

router.get("/engine/positions", (req, res) => {
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const jd = julianDay(at);
  const nodes = lunarNodes(jd);
  res.json({
    at: at.toISOString(),
    bodies: [
      ...getPlanetPositions(jd).map(p => ({ body: p.planet, longitude: p.longitude, sign: p.sign, degree: p.degree, retrograde: p.retrograde })),
      { body: "North Node", longitude: nodes.north.longitude, sign: nodes.north.sign, degree: nodes.north.degree, retrograde: true },
      { body: "South Node", longitude: nodes.south.longitude, sign: nodes.south.sign, degree: nodes.south.degree, retrograde: true },
      ...getAsteroids(jd).map(a => ({ body: a.planet, longitude: a.longitude, sign: a.sign, degree: a.degree, retrograde: a.retrograde })),
    ],
  });
});

router.get("/engine/moon-condition", (req, res) => {
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const jd = julianDay(at);
  const moon = getPlanetPositions(jd).find(p => p.planet === "Moon")!;
  const { name: phaseName, fraction } = moonPhase(jd);
  const fin = moonFinalAspectInSign(jd);
  const ecl = eclipseWindow(jd);
  res.json({
    at: at.toISOString(),
    sign: moon.sign, degree: moon.degree,
    phaseName, illumination: fraction,
    voidOfCourse: voidOfCourse(jd).voc,
    finalAspectInSign: fin ? { planet: fin.planet, aspect: fin.aspect, at: new Date((fin.atJd - 2440587.5) * 86400000).toISOString() } : null,
    eclipseWindow: ecl.active ? { kind: ecl.kind, daysAway: ecl.daysAway } : null,
  });
});

router.get("/engine/planetary-hour", (req, res) => {
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const lat = numQ(req, "lat", 40.7), lon = numQ(req, "lon", -74.0);
  const ph = getPlanetaryHour(at, lat, lon);
  const upcoming: { ruler: string; startsAt: string }[] = [];
  let cursor = new Date(ph.endTime.getTime() + 60000);
  while (upcoming.length < 4) {
    const next = getPlanetaryHour(cursor, lat, lon);
    upcoming.push({ ruler: next.ruler, startsAt: next.startTime.toISOString() });
    cursor = new Date(next.endTime.getTime() + 60000);
  }
  res.json({
    at: at.toISOString(),
    ruler: ph.ruler, began: ph.startTime.toISOString(), ends: ph.endTime.toISOString(),
    isDayHour: ph.isDayHour, hourNumber: ph.hourNumber, upcoming,
  });
});

router.get("/engine/angularity", (req, res) => {
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const lat = numQ(req, "lat", 40.7), lon = numQ(req, "lon", -74.0);
  const jd = julianDay(at);
  res.json({
    at: at.toISOString(),
    angles: getLocalAngles(jd, lat, lon),
    angularPlanets: getAngularPlanets(jd, lat, lon),
    nextCrossings: getNextAngularCrossings(jd, lat, lon).slice(0, 8),
  });
});

// ── Judged layer ─────────────────────────────────────────────────────────────

router.post("/engine/transits", (req, res) => {
  const parsed = parseBirthProfile(req.body);
  if (!parsed) { res.status(400).json({ error: "a birth profile is required" }); return; }
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const transits = computeTransitAspects(parsed.natal)
    .filter(t => parsed.timeKnown || t.natalPlanet !== "Ascendant");
  // The reading's personal voices ride along — the weighted, worded layer.
  const reading = dayReading(at, numQ(req, "lat", 40.7), numQ(req, "lon", -74.0),
    { natal: natalForReading(parsed.natal, parsed.timeKnown) });
  res.json({
    at: at.toISOString(),
    transits,
    voices: reading.testimonies.filter(t => t.source.startsWith("transit:")),
  });
});

router.post("/engine/reading", (req, res) => {
  const at = atOf(req);
  if (!at) { res.status(400).json({ error: "invalid `at` (ISO datetime)" }); return; }
  const scope = req.query.scope === "day" ? "day" as const : "moment" as const;
  const lat = numQ(req, "lat", 40.7), lon = numQ(req, "lon", -74.0);
  const tzOffsetMin = Math.round(numQ(req, "tz", 0));
  const parsed = parseBirthProfile(req.body);
  if (parsed && "error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const natal = parsed ? natalForReading(parsed.natal, parsed.timeKnown) : undefined;
  const ascRuler = parsed?.timeKnown ? domicileLord(parsed.natal.ascendant.longitude) : undefined;
  res.json({
    at: at.toISOString(), scope, personalized: !!parsed,
    reading: dayReading(at, lat, lon, { tzOffsetMin, scope, natal, ascRuler }),
  });
});

router.post("/engine/find-time", (req, res) => {
  const b = (req.body ?? {}) as { activityKey?: string; span?: string; lat?: number; lon?: number; tzOffsetMin?: number };
  if (!b.activityKey) { res.status(400).json({ error: "activityKey is required — see GET /engine/activities" }); return; }
  const span = ["day", "week", "month"].includes(b.span ?? "") ? b.span as "day" | "week" | "month" : "week";
  const bp = (req.body as { birthProfile?: unknown })?.birthProfile;
  const parsed = bp ? parseBirthProfile({ birthProfile: bp }) : null;
  if (parsed && "error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const result = computeElections({
    activityKey: b.activityKey, span,
    lat: typeof b.lat === "number" ? b.lat : 40.7,
    lon: typeof b.lon === "number" ? b.lon : -74.0,
    tzOffsetMin: typeof b.tzOffsetMin === "number" ? b.tzOffsetMin : 0,
    natal: parsed ? parsed.natal : null,
  });
  if (!result) { res.status(400).json({ error: `unknown activityKey "${b.activityKey}" — see GET /engine/activities` }); return; }
  res.json(result);
});

router.get("/engine/activities", (_req, res) => {
  res.json({
    activities: ACTIVITIES.map(a => ({ key: a.key, label: a.label, gloss: a.gloss, category: a.category })),
  });
});

export default router;
