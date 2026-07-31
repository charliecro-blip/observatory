import { Router, type IRouter } from "express";
import { db, natalCharts, natalBlueprints } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { computeNatalChart } from "../lib/natal.js";
import { requireTesterId } from "../middlewares/testerId.js";
import { selectBlueprintContext, type KnowledgeEntry } from "../lib/knowledge.js";
import { aiUnavailable } from "../lib/aiGuard.js";

const router: IRouter = Router();
const PROMPT_VERSION = "v2";

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

function getMoonPhaseNatal(sunSign: string, sunDeg: number, moonSign: string, moonDeg: number): string {
  const sunLon = (SIGNS.indexOf(sunSign) * 30) + sunDeg;
  const moonLon = (SIGNS.indexOf(moonSign) * 30) + moonDeg;
  const separation = (moonLon - sunLon + 360) % 360;
  if (separation < 45) return "New Moon";
  if (separation < 90) return "Waxing Crescent";
  if (separation < 135) return "First Quarter";
  if (separation < 180) return "Waxing Gibbous";
  if (separation < 225) return "Full Moon";
  if (separation < 270) return "Waning Gibbous";
  if (separation < 315) return "Last Quarter";
  return "Waning Crescent";
}

interface BuildBlueprintResult {
  prompt: string;
  manifest: KnowledgeEntry[];
  totalTokens: number;
}

function buildBlueprintPrompt(stored: typeof natalCharts.$inferSelect): BuildBlueprintResult {
  const natal = computeNatalChart(
    stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset,
  );

  const chartRuler = SIGN_RULERS[natal.ascendant.sign] ?? "Unknown";
  const chartRulerPlanet = natal.planets.find((p) => p.planet === chartRuler);

  const medHouses = [1, 2, 6, 8, 10];
  const houseRulerLines = medHouses.map((n) => {
    const house = natal.houses[n - 1];
    const label = n === 1 ? "1st (Body/Constitution)" : n === 2 ? "2nd (Intake/Nourishment)"
      : n === 6 ? "6th (Health/Illness/Routine)" : n === 8 ? "8th (Chronicity/Hidden Processes)"
      : "10th (Therapy/Direction/MC)";
    const ruler = SIGN_RULERS[house.sign] ?? "Unknown";
    const rulerPlanet = natal.planets.find((p) => p.planet === ruler);
    const rulerStr = rulerPlanet
      ? `${ruler} in ${rulerPlanet.sign} ${rulerPlanet.degree.toFixed(1)}° House ${rulerPlanet.houseNumber}${rulerPlanet.retrograde ? " (retrograde)" : ""}`
      : `${ruler} (position not computed)`;
    return `  - ${label}: ${house.sign}, Ruler → ${rulerStr}`;
  }).join("\n");

  const allPlanets = natal.planets.map((p) =>
    `  ${p.planet}: ${p.sign} ${p.degree.toFixed(1)}°, House ${p.houseNumber}${p.retrograde ? " (retrograde)" : ""}`
  ).join("\n");

  const allHouses = natal.houses.map((h) =>
    `  House ${h.number}: ${h.sign}${h.planets.length > 0 ? ` [contains: ${h.planets.join(", ")}]` : ""}`
  ).join("\n");

  const sunPlanet = natal.planets.find((p) => p.planet === "Sun");
  const sect = sunPlanet && sunPlanet.houseNumber >= 7 ? "Day" : "Night";

  const moonPlanet = natal.planets.find((p) => p.planet === "Moon");
  const moonPhase = sunPlanet && moonPlanet
    ? getMoonPhaseNatal(sunPlanet.sign, sunPlanet.degree, moonPlanet.sign, moonPlanet.degree)
    : "Unknown";

  const sixthHouseSign = natal.houses[5]?.sign ?? "";
  const eighthHouseSign = natal.houses[7]?.sign ?? "";

  const knowledge = selectBlueprintContext({
    ascSign: natal.ascendant.sign,
    chartRulerPlanet: chartRuler,
    sixthHouseSign,
    eighthHouseSign,
  });

  const prompt = `You are a medical astrology analyst. Generate a comprehensive natal health blueprint for the following chart. This is a self-tracking and educational tool — not medical advice, not a diagnosis, not a prescription.
${knowledge.block}
NATAL CHART DATA:
Ascendant: ${natal.ascendant.sign} ${natal.ascendant.degree.toFixed(1)}°
Chart Ruler: ${chartRuler}${chartRulerPlanet ? ` in ${chartRulerPlanet.sign} ${chartRulerPlanet.degree.toFixed(1)}° House ${chartRulerPlanet.houseNumber}${chartRulerPlanet.retrograde ? " (retrograde)" : ""}` : ""}
Midheaven: ${natal.midheaven.sign} ${natal.midheaven.degree.toFixed(1)}°
Sect: ${sect} chart (Sun in House ${sunPlanet?.houseNumber ?? "?"})
Natal Moon Phase: ${moonPhase}

All Planetary Positions:
${allPlanets}

All Houses:
${allHouses}

Health-Relevant House Analysis:
${houseRulerLines}

---
Generate a natal medical astrology blueprint as a JSON object with exactly these keys. Return ONLY the JSON — no markdown, no preamble, no explanation outside the JSON.

QUALITY RULES (mandatory):
1. Every prose field must contain grammatically complete sentences. No single-word answers or lists inside prose fields.
2. Always name the exact planet, sign, degree, and house in every statement. Never say "this planet" — always name it.
3. Do not use vague phrases: "pay attention," "balance is needed," "this is significant," "transformation is possible," "you are sensitive," "interesting placement." These are forbidden.
4. Do not diagnose. Do not prescribe. Do not name specific supplements or herbs. Do not say the chart causes illness.
5. Use language such as: "may correspond with," "can describe a tendency toward," "is worth tracking," "the placement suggests," "can describe."
6. contradictionsMixedTestimony must identify actual contradictions in this specific chart — shared rulerships, mixed benefic/malefic testimony, planets with dignity but difficult aspects, benefics ruling difficult houses, malefics well-placed. If a planet rules two health-relevant houses, analyze what that means. If testimony is relatively unified, state why with specific evidence from the chart. Do not produce generic statements.
7. whatToTrack: each item must be a complete phrase describing what to watch and why (e.g., "Digestive sensitivity after emotionally charged days — track 1–10 daily and note triggers"). Not single words.
8. supportivePrinciples: each must be a specific principle grounded in a named chart placement (e.g., "Moon in Scorpio in the 6th: health routines that include emotional processing and somatic release are especially stabilizing for this constitution"). Generic wellness advice is forbidden.
9. safetyNote: a single paragraph, calm and clear, reminding the user this is an educational framework for pattern awareness, not a substitute for professional medical care.

Return exactly this JSON:
{
  "constitutionOverview": "3–5 sentences: constitutional type from Ascendant, chart ruler, and sect; Moon's role in body rhythm; overall vitality signature",
  "ascendantBodyVitality": "3–5 sentences: how the Ascendant sign and chart ruler describe body type, vitality pattern, physical strengths and characteristic vulnerabilities",
  "moonBodyRhythm": "3–5 sentences: Moon sign, house, what it suggests about body rhythm, fluid regulation, emotional-physical interface, cyclical needs",
  "sixthHousePatterns": "3–5 sentences: 6th house sign, ruler placement, characteristic health patterns, imbalance tendencies, routine themes",
  "secondHouseIntake": "2–4 sentences: 2nd house sign and ruler, appetite and diet patterns, nourishment tendencies, physical intake themes",
  "eighthHouseProcesses": "2–4 sentences: 8th house sign and ruler, chronic patterns, elimination, constitutional depth, hidden process themes",
  "tenthHouseTherapies": "2–4 sentences: 10th house/MC sign and ruler, what types of intervention and therapeutic direction may suit this constitution",
  "marsSaturnStress": "3–5 sentences: Mars and Saturn exact positions, how they interact in this chart, stress/heat/constraint/depletion signatures",
  "venusJupiterSupport": "2–4 sentences: Venus and Jupiter exact positions, how they support the constitution, restoration and nourishment themes",
  "contradictionsMixedTestimony": "3–6 sentences: specific contradictions — shared rulerships, mixed testimonies, benefics ruling difficult houses, malefics well-placed. Name specific planets and houses. Do not flatten contradictions.",
  "whatToTrack": ["Complete tracking phrase 1", "...(5–8 total)"],
  "supportivePrinciples": ["Named-placement principle 1", "...(5–8 total)"],
  "safetyNote": "Single paragraph safety note"
}`;

  return { prompt, manifest: knowledge.manifest, totalTokens: knowledge.totalTokens };
}

// GET /api/natal-chart/blueprint
router.get("/natal-chart/blueprint", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;

  const natalRow = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!natalRow) {
    res.status(404).json({ error: "no_natal_chart", message: "No natal chart saved yet" });
    return;
  }

  const blueprint = (await db.select().from(natalBlueprints).where(eq(natalBlueprints.testerId, testerId)).limit(1))[0] ?? null;
  if (!blueprint) {
    res.status(404).json({ error: "no_blueprint", message: "No blueprint generated yet" });
    return;
  }

  res.json({
    id: blueprint.id,
    testerId: blueprint.testerId,
    natalChartId: blueprint.natalChartId,
    content: blueprint.blueprintJson,
    promptVersion: blueprint.promptVersion,
    createdAt: blueprint.createdAt,
    updatedAt: blueprint.updatedAt,
  });
});

// POST /api/natal-chart/blueprint/generate
router.post("/natal-chart/blueprint/generate", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const force = req.body?.force === true;

  // The one AI route with no deterministic fallback — a blueprint IS the
  // generated prose, so there is nothing to degrade to. 503 rather than the
  // 500 it used to report: the client already maps 503 to "the AI service
  // isn't configured", while a 500 reads as a transient glitch and invites a
  // retry that cannot succeed.
  if (aiUnavailable(res)) return;

  const natalRow = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!natalRow) {
    res.status(404).json({ error: "no_natal_chart", message: "No natal chart saved yet" });
    return;
  }

  if (!force) {
    const existing = (await db.select().from(natalBlueprints)
      .where(and(
        eq(natalBlueprints.testerId, testerId),
        eq(natalBlueprints.natalChartId, natalRow.id),
        eq(natalBlueprints.promptVersion, PROMPT_VERSION),
      ))
      .limit(1))[0] ?? null;

    if (existing?.blueprintJson) {
      res.json({
        id: existing.id,
        testerId: existing.testerId,
        natalChartId: existing.natalChartId,
        content: existing.blueprintJson,
        promptVersion: existing.promptVersion,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
      return;
    }
  }

  const { prompt, manifest, totalTokens } = buildBlueprintPrompt(natalRow);

  req.log.info(
    {
      flow: "blueprint",
      knowledgeManifest: manifest.map((e) => ({
        file: e.file,
        section: e.section,
        label: e.label,
        approxTokens: e.approxTokens,
      })),
      totalKnowledgeTokens: totalTokens,
    },
    "[knowledge] Blueprint context injected",
  );

  let rawContent = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });
    rawContent = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    req.log.error({ err }, "Blueprint OpenAI call failed");
    res.status(500).json({ error: "ai_unavailable", message: "AI service unavailable — please try again" });
    return;
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(extractJson(rawContent));
  } catch {
    req.log.error({ snippet: rawContent.slice(0, 500) }, "Blueprint JSON parse failed");
    res.status(500).json({ error: "parse_failed", message: "AI returned malformed data — please try again" });
    return;
  }

  const existing = (await db.select().from(natalBlueprints).where(eq(natalBlueprints.testerId, testerId)).limit(1))[0] ?? null;

  let saved: typeof natalBlueprints.$inferSelect;
  if (existing) {
    const [updated] = await db.update(natalBlueprints)
      .set({
        natalChartId: natalRow.id,
        blueprintJson: parsedContent,
        promptVersion: PROMPT_VERSION,
        chartUpdatedAt: natalRow.updatedAt,
        updatedAt: new Date(),
      })
      .where(eq(natalBlueprints.id, existing.id))
      .returning();
    saved = updated;
  } else {
    const [inserted] = await db.insert(natalBlueprints).values({
      testerId,
      natalChartId: natalRow.id,
      blueprintJson: parsedContent,
      promptVersion: PROMPT_VERSION,
      chartUpdatedAt: natalRow.updatedAt,
    }).returning();
    saved = inserted;
  }

  res.json({
    id: saved.id,
    testerId: saved.testerId,
    natalChartId: saved.natalChartId,
    content: saved.blueprintJson,
    promptVersion: saved.promptVersion,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  });
});

export default router;
