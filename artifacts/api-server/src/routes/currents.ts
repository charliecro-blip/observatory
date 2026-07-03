/**
 * GET /api/currents — long-term personal cycles (needs a natal chart).
 *   ?houseSystem=whole-sign|equal|porphyry|placidus|regiomontanus (default whole-sign)
 *
 * Returns the profected year/month (+ time-lord) and each slow planet's current
 * natal-house tenancy with approximate ingress/egress dates.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeNatalChart, computeTransitAspects, computePlanetarySensitivity } from "../lib/natal.js";
import { computeProfection, computeTransitsByHouse } from "../lib/currents.js";
import { HOUSE_SYSTEMS, type HouseSystem } from "../lib/houses.js";

const router: IRouter = Router();

router.get("/currents", async (req, res) => {
  const testerId = (req.headers["x-tester-id"] as string) ?? null;
  if (!testerId) return res.status(401).json({ error: "tester id required" });

  const reqSystem = (req.query.houseSystem as string) ?? "whole-sign";
  const houseSystem: HouseSystem = HOUSE_SYSTEMS.includes(reqSystem as HouseSystem)
    ? (reqSystem as HouseSystem) : "whole-sign";

  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored) return res.json({ hasChart: false });

  try {
    const natal = computeNatalChart(
      stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset, houseSystem,
    );
    const now = new Date();
    const profection = computeProfection(stored.birthDate, now, natal.ascendant.sign);
    const cusps = natal.houses.map((h) => h.cuspDegree);
    const transitsByHouse = computeTransitsByHouse(now, cusps);

    const transitAspects = computeTransitAspects(natal);
    const SLOW_PLANETS = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
    const HARD_ASPECTS = new Set(["Conjunction", "Square", "Opposition"]);

    // Major transits — significant aspects the slow (chapter-defining) planets are
    // currently making to natal points. transitsByHouse only shows which house a
    // slow planet occupies; this surfaces the actual aspects, which is what
    // classically counts as a "major transit" (a Saturn square, a Pluto conjunction).
    const majorTransits = transitAspects
      .filter((t) => SLOW_PLANETS.has(t.transitPlanet) && (t.severity === "strong" || t.severity === "major"))
      .sort((a, b) => (a.exact === b.exact ? a.orb - b.orb : a.exact ? -1 : 1))
      .slice(0, 8)
      .map((t) => ({
        transitPlanet: t.transitPlanet,
        aspect: t.aspect,
        natalPlanet: t.natalPlanet,
        natalSign: t.natalSign,
        natalHouse: t.natalHouse,
        orb: t.orb,
        exact: t.exact,
        severity: t.severity,
        likelyDomains: t.likelyDomains,
      }));

    // Planetary sensitivity — a natal-chart HINT (not the diagnosis) covering all
    // ten planets, since any planet can be a personal trigger. The frontend uses
    // this to pre-suggest likely answers in a questionnaire; the actual "which
    // planets are hard for you" call is self-reported by the user and stored
    // client-side, not decided here.
    const sensitivity = computePlanetarySensitivity(natal);

    // Caution windows — a flagged planet's difficult quality only "activates"
    // when a FAST body (the Moon, or the Sun) forms a hard aspect to that
    // planet's NATAL position. That's a genuine short window, not a months-long
    // always-on condition. (The old logic keyed off the caution planet being
    // the *transiting* body, so slow outer-planet transits — which last months
    // — showed as permanently "active," lighting up five at once and alarming
    // people.) Tight orb only; the frontend matches `cautionPlanet` against the
    // user's own self-reported list.
    const FAST_TRIGGERS = new Set(["Moon", "Sun"]);
    const cautionWindows = transitAspects
      .filter((t) => FAST_TRIGGERS.has(t.transitPlanet) && HARD_ASPECTS.has(t.aspect) && t.orb <= 3)
      .sort((a, b) => a.orb - b.orb)
      .slice(0, 8)
      .map((t) => ({
        triggerPlanet: t.transitPlanet, // Moon or Sun — the fast body lighting it up
        cautionPlanet: t.natalPlanet,   // the flagged natal placement (frontend matches on this)
        aspect: t.aspect,
        natalSign: t.natalSign,
        natalHouse: t.natalHouse,
        orb: t.orb,
        exact: t.exact,
      }));

    return res.json({
      hasChart: true,
      houseSystem,
      ascendant: natal.ascendant,
      profection,
      transitsByHouse,
      majorTransits,
      sensitivity,
      cautionWindows,
    });
  } catch (err) {
    return res.status(500).json({ error: "failed to compute currents", detail: String(err) });
  }
});

/**
 * GET /api/currents/caution-days — forward scan of the user's self-reported
 * caution planets against their natal chart.
 *   ?planets=Mars,Saturn   the planets the user marked in the questionnaire
 *   ?days=30               how far ahead to scan (max 45)
 *   ?tz=300                viewer tz offset (minutes; getTimezoneOffset convention)
 *
 * Returns, per viewer-local day, the hard aspects (conjunction/square/
 * opposition, non-mild) any listed planet makes to a natal point — the data
 * behind ⚠ marks on the Ahead calendar. Self-reported sensitivities live
 * client-side, so the planet list arrives as a query param rather than being
 * read from the database.
 */
router.get("/currents/caution-days", async (req, res) => {
  const testerId = (req.headers["x-tester-id"] as string) ?? null;
  if (!testerId) return res.status(401).json({ error: "tester id required" });

  const planets = ((req.query.planets as string) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (planets.length === 0) return res.json({ hasChart: true, days: [] });

  const numDays = Math.min(45, Math.max(1, parseInt((req.query.days as string) ?? "30", 10)));
  const tzOffsetMin = Number.isFinite(parseInt((req.query.tz as string) ?? "", 10))
    ? parseInt((req.query.tz as string), 10)
    : 0;
  const reqSystem = (req.query.houseSystem as string) ?? "whole-sign";
  const houseSystem: HouseSystem = HOUSE_SYSTEMS.includes(reqSystem as HouseSystem)
    ? (reqSystem as HouseSystem) : "whole-sign";

  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored) return res.json({ hasChart: false, days: [] });

  try {
    const natal = computeNatalChart(
      stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset, houseSystem,
    );

    const HARD = new Set(["Conjunction", "Square", "Opposition"]);
    const planetSet = new Set(planets);

    // Viewer-local midnight as a UTC instant, then sample each day at local noon.
    const shifted = new Date(Date.now() - tzOffsetMin * 60000);
    const localMidnightMs =
      Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + tzOffsetMin * 60000;

    const days: Array<{
      date: string;
      hits: Array<{ triggerPlanet: string; cautionPlanet: string; aspect: string; orb: number; severity: string }>;
    }> = [];

    for (let d = 0; d < numDays; d++) {
      const noon = new Date(localMidnightMs + d * 86400000 + 12 * 3600000);
      // Calendar caution marks use the SUN as the sole trigger — a Sun hard
      // aspect to a natal flagged planet lasts a few days and reads as a real
      // "period" (a few times a year per planet), so marks stay sparing and
      // meaningful. The Moon (used in the live view) would hit every point
      // monthly and flood the calendar.
      const hits = computeTransitAspects(natal, noon)
        .filter((t) => t.transitPlanet === "Sun" && planetSet.has(t.natalPlanet) && HARD.has(t.aspect) && t.orb <= 3)
        .sort((a, b) => a.orb - b.orb)
        .slice(0, 2)
        .map((t) => ({
          triggerPlanet: t.transitPlanet,
          cautionPlanet: t.natalPlanet,
          aspect: t.aspect,
          orb: t.orb,
          severity: t.severity,
        }));
      if (hits.length > 0) {
        const localDate = new Date(localMidnightMs + d * 86400000 - tzOffsetMin * 60000);
        days.push({ date: localDate.toISOString().slice(0, 10), hits });
      }
    }

    return res.json({ hasChart: true, days });
  } catch (err) {
    return res.status(500).json({ error: "failed to compute caution days", detail: String(err) });
  }
});

export default router;
