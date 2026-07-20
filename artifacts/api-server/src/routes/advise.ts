/**
 * POST /api/advise
 *
 * Moment Advisor: streaming conversational AI that interprets the current
 * astrological moment in light of the user's goals, tasks, and habits.
 *
 * Body: {
 *   intention?: string;          // e.g. "workout", "focus", "create"
 *   message: string;             // user's freeform message or intent
 *   history?: {role:"user"|"assistant"; content:string}[];
 *   lat?: number;
 *   lon?: number;
 * }
 */
import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { tasks, habits, goals, daemonMemory } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  julianDay, moonPhase, getPlanetPositions,
  voidOfCourse, getPlanetaryHour, getDailyElementEmphasis,
  getMajorAspects,
} from "../lib/astro.js";

const router: IRouter = Router();

const PLANETARY_HOUR_SUPPORTS: Record<string, string[]> = {
  Moon:    ["body care", "home", "rest", "emotional processing", "food", "care", "domestic rhythms"],
  Mercury: ["writing", "calls", "email", "scheduling", "study", "editing", "sorting", "commerce"],
  Venus:   ["art", "design", "relational care", "pleasure", "invitations", "aesthetic refinement"],
  Mars:    ["movement", "action", "exercise", "boundary work", "errands", "hard edits", "decisive action"],
  Jupiter: ["teaching", "publishing", "big-picture planning", "outreach", "generosity", "launches"],
  Saturn:  ["structure", "discipline", "planning", "accounting", "cleanup", "commitments", "finishing"],
  Sun:     ["visibility", "presenting", "leadership", "self-expression", "creative confidence"],
};

const ELEMENT_QUALITIES: Record<string, string> = {
  fire:   "active and initiating — good for action, expression, movement",
  earth:  "grounding and steady — good for building, tending, material care",
  air:    "mentally alive — good for communication, learning, connection",
  water:  "inward and receptive — good for reflection, feeling, emotional depth",
  spirit: "liminal — good for rest, inner listening, releasing",
};

router.post("/advise", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(400).json({ error: "Missing x-tester-id" }); return; }

  const { message, history = [], lat = 40.7, lon = -74.0, gcalEvents = [], weekSummary = "", electionContext } = req.body as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
    lat?: number;
    lon?: number;
    gcalEvents?: { title: string; start: string; end: string; allDay: boolean }[];
    weekSummary?: string;
    // Optional: the user came from Auspice (the election engine) with a real
    // activity + candidate windows + their own note about it. The windows are
    // GIVEN FACTS from the deterministic engine — Ask advises within them.
    electionContext?: {
      activity?: string;
      note?: string;
      windows?: { label: string; tier?: string; why?: string }[];
    };
  };

  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  // ── Gather astrological context ───────────────────────────────────────────
  const now  = new Date();
  const jd   = julianDay(now);
  const planets = getPlanetPositions(jd);
  const { name: moonPhaseName } = moonPhase(jd);
  const moonSign   = planets.find(p => p.planet === "Moon")!.sign;
  const { voc }    = voidOfCourse(jd);
  const elemEmph   = getDailyElementEmphasis(jd);
  const planHour   = getPlanetaryHour(now, lat, lon);
  const retrogrades = planets.filter(p => p.retrograde).map(p => p.planet);
  const INNER = new Set(["Sun","Moon","Mercury","Venus","Mars"]);
  const aspects = getMajorAspects(jd).filter(a => INNER.has(a.planet1) || INNER.has(a.planet2));
  const moonAspects = aspects.filter(a => a.planet1 === "Moon" || a.planet2 === "Moon");
  const hourSupports = PLANETARY_HOUR_SUPPORTS[planHour.ruler] ?? [];
  const elemQuality = ELEMENT_QUALITIES[elemEmph.element] ?? "";

  // ── Gather user context (non-blocking) ───────────────────────────────────
  let userTasks: string[] = [];
  let userHabits: string[] = [];
  let userGoals: string[] = [];
  let memoryLines: string[] = [];

  try {
    const [taskRows, habitRows, goalRows, memoryRows] = await Promise.all([
      db.select({ title: tasks.title, bestWindowType: tasks.bestWindowType })
        .from(tasks)
        .where(and(eq(tasks.testerId, testerId), eq(tasks.done, "false")))
        .limit(10),
      db.select({ name: habits.name, minimumViable: habits.minimumViable })
        .from(habits)
        .where(and(eq(habits.testerId, testerId), eq(habits.status, "active")))
        .limit(8),
      db.select({ title: goals.title })
        .from(goals)
        .where(eq(goals.testerId, testerId))
        .limit(6),
      db.select({ content: daemonMemory.content, createdAt: daemonMemory.createdAt })
        .from(daemonMemory)
        .where(eq(daemonMemory.testerId, testerId))
        .orderBy(daemonMemory.createdAt)
        .limit(10),
    ]);
    userTasks  = taskRows.map((t: { title: string; bestWindowType?: string | null }) => t.bestWindowType ? `${t.title} (best: ${t.bestWindowType})` : t.title);
    userHabits = habitRows.map((h: { name: string; minimumViable?: string | null }) => h.minimumViable ? `${h.name} (minimum: ${h.minimumViable})` : h.name);
    userGoals  = goalRows.map((g: { title: string }) => g.title);
    memoryLines = memoryRows.map((m: { content: string; createdAt: Date }) => `- ${m.content}`);
  } catch {
    // Continue without user context if DB query fails
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const vocNote = voc
    ? "The Moon is void of course right now — a liminal, inward time. Better for finishing and reviewing than starting new things."
    : "";

  const retroNote = retrogrades.length
    ? `Retrograde planets: ${retrogrades.join(", ")}.`
    : "";

  const moonAspectLines = moonAspects.slice(0, 3).map(a => {
    const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
    return `Moon ${a.aspect} ${other} (${a.applying ? "applying" : "separating"}, orb ${a.orb.toFixed(1)}°)`;
  }).join("; ");

  const userSection = [
    userGoals.length  ? `Goals: ${userGoals.join(", ")}` : "",
    userTasks.length  ? `Open tasks: ${userTasks.join(", ")}` : "",
    userHabits.length ? `Active habits: ${userHabits.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const calSection = gcalEvents.length
    ? `TODAY'S CALENDAR:\n${gcalEvents.map(e => {
        if (e.allDay) return `• ${e.title} (all day)`;
        const startStr = new Date(e.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const endStr = new Date(e.end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        return `• ${startStr}–${endStr} ${e.title}`;
      }).join("\n")}`
    : "";

  const electionSection = electionContext?.activity
    ? `\nTHE USER IS ELECTING A TIME FOR: ${electionContext.activity}\n${
        electionContext.windows?.length
          ? `Auspice — the timing engine — already found these candidate windows. Treat them as GIVEN FACTS; do not invent, override, or second-guess the timing:\n${electionContext.windows
              .map(w => `• ${w.label}${w.tier ? ` [${w.tier} time]` : ""}${w.why ? ` — ${w.why}` : ""}`)
              .join("\n")}`
          : "Auspice found no clean window in the span they chose — the sky is quiet for this right now."
      }${
        electionContext.note
          ? `\nWhat they told you about it (their hopes, worries, or constraints): "${electionContext.note}"`
          : ""
      }\n\nHelp them choose among these windows and prepare for the one they pick, honoring what they told you and their goals. Do NOT fabricate astrological timings beyond the windows above — if none fits their constraints, say so plainly and offer the closest honest trade-off.\n`
    : "";

  const systemPrompt = `You are a thoughtful astrological advisor. You speak conversationally — like a knowledgeable, warm friend, not a textbook. Keep responses concise: 2–4 sentences usually, never a wall of text.

Your job is to help the user decide what to do *right now*, using the current astrological moment as a lens. Be concrete and specific. When the sky supports something they're actually working on, name it. When the sky is better for rest or reflection, say so plainly.

You may ask one clarifying question when it would meaningfully sharpen your advice. Don't pepper them with questions.

CURRENT MOMENT (${now.toLocaleString("en-US", { weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}):
• Planetary hour: ${planHour.ruler} — supports ${hourSupports.slice(0,4).join(", ")}
• Moon: ${moonPhaseName} in ${moonSign}${voc ? " (void of course)" : ""}
• Element emphasis: ${elemEmph.element} — ${elemQuality}
${moonAspectLines ? `• Moon aspects: ${moonAspectLines}` : ""}
${vocNote}
${retroNote}
${weekSummary ? `\nWEEK AHEAD QUALITY:\n${weekSummary}` : ""}

${userSection ? `USER'S CONTEXT:\n${userSection}` : "No tasks, habits, or goals on record yet — work from the astrological moment alone."}
${calSection ? `\n${calSection}` : ""}
${electionSection}${memoryLines.length ? `\nDAEMON MEMORY (things the user has asked you to remember across sessions):\n${memoryLines.join("\n")}` : ""}

Respond directly, warmly, and practically. Don't summarize the astrology back to them — use it to inform what you say.`;

  // ── Stream response ───────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: msgs,
      stream: true,
      max_tokens: 400,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message ?? "AI error" })}\n\n`);
    res.end();
  }
});

export default router;
