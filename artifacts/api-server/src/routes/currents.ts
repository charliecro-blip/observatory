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
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";
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

    // Major transits — significant aspects the slow (chapter-defining) planets are
    // currently making to natal points. transitsByHouse only shows which house a
    // slow planet occupies; this surfaces the actual aspects, which is what
    // classically counts as a "major transit" (a Saturn square, a Pluto conjunction).
    const SLOW_PLANETS = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
    const majorTransits = computeTransitAspects(natal)
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

    return res.json({
      hasChart: true,
      houseSystem,
      ascendant: natal.ascendant,
      profection,
      transitsByHouse,
      majorTransits,
    });
  } catch (err) {
    return res.status(500).json({ error: "failed to compute currents", detail: String(err) });
  }
});

export default router;
