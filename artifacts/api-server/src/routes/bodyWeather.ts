import { Router, type IRouter } from "express";
import { db, dailyInsights, dailyCheckIns, natalCharts, cultivations, cultivationCheckIns, supportPreferences } from "@workspace/db";
import { and, eq, gte, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAstroSnapshot } from "../lib/astro.js";
import { computeNatalChart, computeNatalHealthInsights, computeTransitAspects } from "../lib/natal.js";
import type { DailyCheckIn } from "@workspace/db";
import { requireTesterId } from "../middlewares/testerId.js";
import { selectBodyWeatherContext } from "../lib/knowledge.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

interface BodyWeatherData {
  capacityLevel: "Low" | "Medium" | "High";
  capacityScore: number;
  bodyWeatherSummary: string;
  bestUseTags: string[];
  watchForTags: string[];
  supportTags: string[];
  explanation: string;
}

// ── Deterministic fallback ────────────────────────────────────────────────────

function buildFallback(checkIn: DailyCheckIn): BodyWeatherData {
  const energy = checkIn.energy ?? 5;
  const stress = checkIn.stress ?? 5;
  const sleepQuality = checkIn.sleepQuality ?? 5;
  const digestion = checkIn.digestion ?? 5;
  const focus = checkIn.focus ?? 5;
  const symptomTags = (checkIn.symptomTags as string[]) ?? [];
  const behaviorTags = (checkIn.behaviorTags as string[]) ?? [];

  let capacityLevel: "Low" | "Medium" | "High";
  if (energy <= 4 || sleepQuality <= 4 || stress >= 8) {
    capacityLevel = "Low";
  } else if (energy >= 8 && stress <= 5 && sleepQuality >= 6) {
    capacityLevel = "High";
  } else {
    capacityLevel = "Medium";
  }

  const capacityScore = Math.max(
    1,
    Math.min(10, Math.round((energy + (10 - stress) + sleepQuality + focus) / 4)),
  );

  const watchForSet = new Set<string>();
  if (sleepQuality <= 4) watchForSet.add("Poor sleep");
  if (stress >= 7) watchForSet.add("Overstimulation");
  if (digestion <= 4) watchForSet.add("Digestive sensitivity");
  if (focus <= 4) watchForSet.add("Low focus");
  if (symptomTags.some((t) => ["Anxiety", "Restlessness", "Brain fog"].includes(t)))
    watchForSet.add("Overstimulation");
  if (symptomTags.some((t) => ["Fatigue", "Insomnia", "Low mood"].includes(t)))
    watchForSet.add("Emotional heaviness");
  if (behaviorTags.some((t) => ["Conflict", "Overwork", "Travel"].includes(t)))
    watchForSet.add("Social overload");

  const supportSet = new Set<string>();
  if (sleepQuality <= 4) { supportSet.add("Early bedtime"); supportSet.add("Reduce caffeine"); }
  if (stress >= 7) { supportSet.add("Journal"); supportSet.add("Avoid overcommitting"); }
  if (digestion <= 4) { supportSet.add("Eat simply"); supportSet.add("Gentle movement"); }
  if (symptomTags.some((t) => ["Anxiety", "Restlessness", "Brain fog"].includes(t)))
    supportSet.add("Reduce caffeine");
  if (symptomTags.some((t) => ["Fatigue", "Insomnia", "Low mood"].includes(t)))
    supportSet.add("Rest");
  if (behaviorTags.some((t) => ["Conflict", "Overwork", "Travel"].includes(t)))
    supportSet.add("Rest");
  if (energy >= 6 && stress <= 6) { supportSet.add("Walk"); supportSet.add("Get sunlight"); }
  if (supportSet.size === 0) { supportSet.add("Hydrate"); supportSet.add("Walk"); }

  const bestUseTags: string[] =
    capacityLevel === "High"
      ? ["Deep work", "Creative work", "Exercise"]
      : capacityLevel === "Medium"
        ? ["Admin tasks", "Planning", "Social connection"]
        : ["Rest", "Emotional processing"];

  const summaries: Record<string, string> = {
    Low: "Today looks like a lower-capacity day. Prioritize recovery, simpler tasks, and gentle self-care over pushing hard.",
    Medium: "Today has moderate capacity. Focus on steady, meaningful work and keep your schedule manageable.",
    High: "Today looks energized. This is a good day for focused work, creative projects, or physical activity.",
  };

  const explanations: Record<string, string> = {
    Low: `Based on today's check-in, your energy (${energy}/10) and sleep quality (${sleepQuality}/10) suggest your body may benefit from a lighter load today.${stress >= 7 ? ` Your stress level (${stress}/10) is elevated, which may compound fatigue.` : ""} Consider easing into the day and protecting your recovery.`,
    Medium: `Your check-in shows a moderate baseline today — energy at ${energy}/10 and stress at ${stress}/10. This reflects a workable but not peak day. Pacing yourself and choosing focused tasks over scattered effort may help you stay steady.`,
    High: `Your energy (${energy}/10) and sleep quality (${sleepQuality}/10) both look strong today, with manageable stress (${stress}/10). This could be a good day to tackle something meaningful or physically active.`,
  };

  return {
    capacityLevel,
    capacityScore,
    bodyWeatherSummary: summaries[capacityLevel],
    bestUseTags,
    watchForTags: [...watchForSet],
    supportTags: [...supportSet],
    explanation: explanations[capacityLevel],
  };
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateBodyWeather(
  checkIn: DailyCheckIn,
  recentCheckIns: DailyCheckIn[],
  testerId: string,
): Promise<BodyWeatherData> {
  const astro = getAstroSnapshot(new Date());
  const natalRow =
    (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ??
    null;
  const natal = natalRow
    ? computeNatalChart(natalRow.birthDate, natalRow.birthTime, natalRow.birthLat, natalRow.birthLon, natalRow.utcOffset)
    : null;
  const transits = natal ? computeTransitAspects(natal) : [];
  const natalInsights = natal ? computeNatalHealthInsights(natal) : null;

  const checkInSummary = {
    date: checkIn.date,
    energy: checkIn.energy,
    mood: checkIn.mood,
    stress: checkIn.stress,
    focus: checkIn.focus,
    digestion: checkIn.digestion,
    sleepQuality: checkIn.sleepQuality,
    pain: checkIn.pain,
    regulation: checkIn.regulation,
    symptomTags: checkIn.symptomTags,
    behaviorTags: checkIn.behaviorTags,
    notes: checkIn.notes,
  };

  const recentSummary = recentCheckIns.slice(0, 7).map((c) => ({
    date: c.date,
    energy: c.energy,
    mood: c.mood,
    stress: c.stress,
    sleepQuality: c.sleepQuality,
  }));

  const transitSummary = transits
    .slice(0, 5)
    .map((t) => `${t.transitPlanet} ${t.aspect} natal ${t.natalPlanet} [${t.severity}, score ${t.score}, orb ${t.orb.toFixed(1)}°, domains: ${t.likelyDomains.join(", ")}]`)
    .join("; ");

  const natalSection = natal
    ? `Natal chart: ASC ${natal.ascendant.sign} ${natal.ascendant.degree.toFixed(1)}°, ${natal.planets
        .slice(0, 5)
        .map((p) => `${p.planet} ${p.sign} H${p.houseNumber}`)
        .join(", ")}. Health blueprint: ${natalInsights?.summary ?? ""}. Active transits (sorted by weight): ${transitSummary}.`
    : "No natal chart on file.";

  const activeCultivations = await db.select().from(cultivations)
    .where(and(eq(cultivations.testerId, testerId), eq(cultivations.status, "active")))
    .limit(8);

  let cultivationSection = "";
  if (activeCultivations.length > 0) {
    const todayCultivationCheckIns = await db.select().from(cultivationCheckIns)
      .where(and(
        eq(cultivationCheckIns.testerId, testerId),
        eq(cultivationCheckIns.date, todayString()),
      ));
    const ciMap = new Map(todayCultivationCheckIns.map((ci) => [ci.cultivationId, ci]));
    cultivationSection = "\nActive cultivations (practices the user is intentionally tending):\n" +
      activeCultivations.map((c) => {
        const ci = ciMap.get(c.id);
        const status = ci?.completed
          ? `tended today${ci.effortLevel ? ` (effort ${ci.effortLevel}/5)` : ""}${ci.note ? `, note: "${ci.note}"` : ""}`
          : "not yet tended today";
        return `- ${c.domain}: "${c.title}"${c.targetPractice ? ` — practice: ${c.targetPractice}` : ""}. Frequency: ${c.frequency}. Today: ${status}.`;
      }).join("\n");
  }

  const supportPrefsRow = (await db.select().from(supportPreferences)
    .where(eq(supportPreferences.testerId, testerId))
    .limit(1))[0] ?? null;

  const enabledCategories = (supportPrefsRow?.categories as string[]) ?? [];

  const CATEGORY_LABELS: Record<string, string> = {
    "food-rhythm": "food rhythm and nourishment",
    "rest-sleep": "rest and sleep hygiene",
    "movement": "movement practices",
    "somatic": "somatic practices",
    "meditation": "meditation",
    "breathwork": "breathwork",
    "guided-visualization": "guided visualization",
    "journaling": "journaling",
    "acupressure": "acupressure",
    "aromatherapy": "aromatherapy",
    "herbal-research": "herbal categories (research only — never specific herbs or dosages)",
    "creative-practice": "creative practice",
    "social-boundary": "social and boundary practices",
  };

  let supportPrefsSection = "";
  if (enabledCategories.length > 0) {
    const labels = enabledCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ");
    supportPrefsSection = `\nSupport preferences — the user has opted into these categories only:\n${labels}`;
    if (enabledCategories.includes("herbal-research")) {
      supportPrefsSection += `\nHerbal note: phrase as "herbal categories to research with a qualified practitioner" — never name specific herbs or dosages.`;
    }
  }

  const topTransitPlanets = transits.slice(0, 2).map((t) => t.transitPlanet);
  const moonSign = astro.moonSign;

  const knowledge = selectBodyWeatherContext({ moonSign, topTransitPlanets });

  logger.info(
    {
      flow: "body-weather",
      testerId,
      knowledgeManifest: knowledge.manifest.map((e) => ({
        file: e.file,
        section: e.section,
        label: e.label,
        approxTokens: e.approxTokens,
      })),
      totalKnowledgeTokens: knowledge.totalTokens,
    },
    "[knowledge] Body Weather context injected",
  );

  const systemPrompt = `You are AstroHealth Body Weather generator. Return ONLY a valid JSON object — no markdown, no extra text, no explanation outside the JSON.
${knowledge.block}
Safety rules (non-negotiable):
- Do not diagnose or prescribe.
- Do not say astrology causes symptoms.
- Use language like "may correspond with," "could reflect," "worth tracking," "based on today's check-in," "can describe a tendency toward."
- Keep tone calm, practical, non-fatalistic, and grounded.
- If support preferences are set (provided in user context), suggest supportive practices ONLY from those categories. Do not suggest categories the user has not opted into.

Grammar and clarity rules (non-negotiable):
- Every sentence must be grammatically complete and correct.
- Do not write awkward compound sentences where a full clause is embedded inside another clause.
- Do not use keyword dumps or vague phrases like "vitality is active," "this is a time of transformation," "pay attention to your body," or "balance is needed."
- Write like a thoughtful practitioner, not a horoscope generator.

Specificity rules:
- When referencing a transit, include: the transiting planet, the natal point or house involved, and what domain to track.
- Do not write "vitality is active" — instead describe what is happening and what to watch.
- The explanation field must weave check-in data (name the specific scores) with astrological context (name the specific planet/aspect if relevant), then suggest something concrete to track.

bodyWeatherSummary: 2–3 complete sentences describing today's overall body weather. Reference specific check-in metrics (e.g. "energy at 4/10") and any relevant sky context. Avoid generic openers like "Today is a day of…"

explanation: 2–4 sentences. Structure as: (1) what the check-in data shows, naming scores; (2) what astrological context may correspond with this, if any; (3) one concrete tracking suggestion or supportive action. Do not produce a vague paragraph.

Choose bestUseTags ONLY from: Rest, Deep work, Creative work, Social connection, Admin tasks, Exercise, Emotional processing, Planning, Client work
Choose watchForTags ONLY from: Overstimulation, Poor sleep, Digestive sensitivity, Irritability, Low focus, Emotional heaviness, Inflammation/heat, Social overload
Choose supportTags ONLY from: Walk, Rest, Eat simply, Hydrate, Reduce caffeine, Journal, Avoid overcommitting, Get sunlight, Gentle movement, Early bedtime

Return this exact JSON structure:
{
  "capacityLevel": "Low" | "Medium" | "High",
  "capacityScore": <integer 1-10>,
  "bodyWeatherSummary": "<2-3 sentences summarizing today>",
  "bestUseTags": ["<tag>", ...],
  "watchForTags": ["<tag>", ...],
  "supportTags": ["<tag>", ...],
  "explanation": "<2-4 sentences: check-in data → astrological context → tracking suggestion>"
}`;

  const userContent = `Today's check-in:
${JSON.stringify(checkInSummary, null, 2)}

Recent check-ins (last 7 days):
${JSON.stringify(recentSummary, null, 2)}

Today's sky:
Moon: ${astro.moonPhase} in ${astro.moonSign} · Sun in ${astro.sunSign}
Active transits: ${astro.activeTransits.join("; ")}

${natalSection}
${cultivationSection}
${supportPrefsSection}

Generate the Body Weather JSON now.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as Partial<BodyWeatherData>;

    if (
      parsed.capacityLevel &&
      ["Low", "Medium", "High"].includes(parsed.capacityLevel) &&
      parsed.bodyWeatherSummary &&
      parsed.explanation
    ) {
      return {
        capacityLevel: parsed.capacityLevel,
        capacityScore: parsed.capacityScore ?? 5,
        bodyWeatherSummary: parsed.bodyWeatherSummary,
        bestUseTags: parsed.bestUseTags ?? [],
        watchForTags: parsed.watchForTags ?? [],
        supportTags: parsed.supportTags ?? [],
        explanation: parsed.explanation,
      };
    }
  } catch {
    // fall through to deterministic fallback
  }

  return buildFallback(checkIn);
}

// ── Save insight ──────────────────────────────────────────────────────────────

async function saveInsight(
  checkIn: DailyCheckIn,
  data: BodyWeatherData,
  testerId: string,
): Promise<typeof dailyInsights.$inferSelect> {
  const [row] = await db
    .insert(dailyInsights)
    .values({
      testerId,
      date: checkIn.date,
      checkInId: checkIn.id,
      checkInUpdatedAt: checkIn.updatedAt.toISOString(),
      capacityLevel: data.capacityLevel,
      capacityScore: data.capacityScore,
      bodyWeatherSummary: data.bodyWeatherSummary,
      bestUseTags: data.bestUseTags,
      watchForTags: data.watchForTags,
      supportTags: data.supportTags,
      explanation: data.explanation,
      generatedContext: {
        astroDate: new Date().toISOString(),
        checkInDate: checkIn.date,
      },
    })
    .onConflictDoUpdate({
      target: [dailyInsights.testerId, dailyInsights.date],
      set: {
        checkInId: checkIn.id,
        checkInUpdatedAt: checkIn.updatedAt.toISOString(),
        capacityLevel: data.capacityLevel,
        capacityScore: data.capacityScore,
        bodyWeatherSummary: data.bodyWeatherSummary,
        bestUseTags: data.bestUseTags,
        watchForTags: data.watchForTags,
        supportTags: data.supportTags,
        explanation: data.explanation,
        generatedContext: {
          astroDate: new Date().toISOString(),
          checkInDate: checkIn.date,
        },
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/body-weather/today", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const today = todayString();

  const [checkIn] = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), eq(dailyCheckIns.date, today)));

  if (!checkIn) {
    res.json({ checkInRequired: true });
    return;
  }

  const [existing] = await db
    .select()
    .from(dailyInsights)
    .where(and(eq(dailyInsights.testerId, testerId), eq(dailyInsights.date, today)));

  if (existing && existing.checkInUpdatedAt === checkIn.updatedAt.toISOString()) {
    res.json(existing);
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const recentCheckIns = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, cutoffStr)))
    .orderBy(desc(dailyCheckIns.date))
    .limit(14);

  const data = await generateBodyWeather(checkIn, recentCheckIns, testerId);
  const saved = await saveInsight(checkIn, data, testerId);

  res.json(saved);
});

router.post("/body-weather/regenerate", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const today = todayString();

  const [checkIn] = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), eq(dailyCheckIns.date, today)));

  if (!checkIn) {
    res.json({ checkInRequired: true });
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const recentCheckIns = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, cutoffStr)))
    .orderBy(desc(dailyCheckIns.date))
    .limit(14);

  const data = await generateBodyWeather(checkIn, recentCheckIns, testerId);
  const saved = await saveInsight(checkIn, data, testerId);

  res.json(saved);
});

export default router;
