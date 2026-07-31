import { Router, type IRouter } from "express";
import multer from "multer";
import { db, conversations, messages, natalCharts } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ensureCompatibleFormat,
  voiceChatStream,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  CreateConversationBody,
  GetConversationParams,
  SendMessageParams,
  SendMessageBody,
  SendVoiceMessageParams,
} from "@workspace/api-zod";
import { getAstroSnapshot } from "../lib/astro.js";
import { computeNatalChart, computeNatalHealthInsights, computeTransitAspects, type TransitAspect } from "../lib/natal.js";
import { requireTesterId } from "../middlewares/testerId.js";
import { selectOracleContext } from "../lib/knowledge.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/openai/conversations", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.testerId, testerId))
    .orderBy(asc(conversations.createdAt));
  res.json(rows);
});

router.post("/openai/conversations", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = CreateConversationBody.parse(req.body);
  const [row] = await db
    .insert(conversations)
    .values({ title: body.title ?? "New conversation", testerId })
    .returning();
  res.status(201).json(row);
});

router.get("/openai/conversations/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = GetConversationParams.parse(req.params);
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.testerId, testerId)));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...conversation, messages: msgs });
});

router.post("/openai/conversations/:id/messages", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = SendMessageParams.parse(req.params);
  const { content } = SendMessageBody.parse(req.body);

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.testerId, testerId)));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const astro = getAstroSnapshot(new Date());
  const natalRow = (
    await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1)
  )[0] ?? null;
  const natalChart = natalRow
    ? computeNatalChart(natalRow.birthDate, natalRow.birthTime, natalRow.birthLat, natalRow.birthLon, natalRow.utcOffset)
    : null;
  const natalInsights = natalChart ? computeNatalHealthInsights(natalChart) : null;
  const natalTransits = natalChart ? computeTransitAspects(natalChart) : [];

  const topTransitPlanets = natalTransits.slice(0, 2).map((t) => t.transitPlanet);
  const ascSign = natalChart?.ascendant.sign ?? "";

  const knowledge = selectOracleContext({ ascSign, topTransitPlanets });

  logger.info(
    {
      flow: "oracle",
      conversationId: id,
      testerId,
      knowledgeManifest: knowledge.manifest.map((e) => ({
        file: e.file,
        section: e.section,
        label: e.label,
        approxTokens: e.approxTokens,
      })),
      totalKnowledgeTokens: knowledge.totalTokens,
    },
    "[knowledge] Oracle context injected",
  );

  const systemPrompt = buildSystemPrompt(astro, natalChart, natalInsights, natalTransits, knowledge.block);

  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI unavailable" })}\n\n`);
  }
  res.end();
});

router.post(
  "/openai/conversations/:id/voice-messages",
  requireTesterId,
  upload.single("audio"),
  async (req, res) => {
    const testerId = res.locals.testerId as string;
    const { id } = SendVoiceMessageParams.parse(req.params);

    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.testerId, testerId)));
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const { buffer, format } = await ensureCompatibleFormat(req.file.buffer);
      const stream = await voiceChatStream(buffer, "alloy", format);

      // `voiceChatStream` yields only "transcript" (the ASSISTANT's words) and
      // "audio". There has never been a "user_transcript" event, so the branch
      // that used to be here could not fire and the user's own words were
      // never captured — every voice message is stored as "[voice message]".
      // The compiler said so ("types have no overlap") the whole time; nothing
      // was reading it, because this package was never typechecked from source.
      //
      // Left as-is rather than quietly changed: the honest fix is to run
      // `speechToText` over the uploaded buffer, which costs an extra API call
      // per message in an app outside this session's scope. Recorded in
      // BACKLOG §3b instead of guessed at here.
      let assistantTranscript = "";
      const userTranscript = "";

      for await (const event of stream) {
        if (event.type === "transcript") assistantTranscript += event.data;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      await db.insert(messages).values([
        {
          conversationId: id,
          role: "user",
          content: userTranscript || "[voice message]",
        },
        {
          conversationId: id,
          role: "assistant",
          content: assistantTranscript,
        },
      ]);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: "Voice processing failed" })}\n\n`);
    }
    res.end();
  },
);

function buildSystemPrompt(
  astro: ReturnType<typeof getAstroSnapshot>,
  natal: ReturnType<typeof computeNatalChart> | null,
  natalInsights: ReturnType<typeof computeNatalHealthInsights> | null,
  natalTransits: TransitAspect[],
  knowledgeBlock: string,
): string {
  const todayPlanets = astro.planets
    .map((p) => `${p.planet} in ${p.sign} (${p.degree.toFixed(1)}°)`)
    .join(", ");

  let natalSection = "";
  if (natal) {
    const natalPlanets = natal.planets
      .map((p) => `${p.planet} ${p.sign} ${p.degree.toFixed(1)}° H${p.houseNumber}`)
      .join(", ");
    const blueprintItems = natalInsights
      ? [
          natalInsights.summary,
          `6th house (health): ${natalInsights.sixthHouse.themes.slice(0, 3).join(", ")}`,
        ].join(" | ")
      : "";

    const topTransits = natalTransits
      .slice(0, 5)
      .map((t) =>
        `${t.transitPlanet} ${t.aspect} natal ${t.natalPlanet} [${t.severity}, score ${t.score}, orb ${t.orb.toFixed(1)}°, domains: ${t.likelyDomains.join(", ")}]`
      )
      .join("; ");

    natalSection = `
User's natal chart (birth data on file):
- Ascendant: ${natal.ascendant.sign} ${natal.ascendant.degree.toFixed(1)}°
- Midheaven: ${natal.midheaven.sign} ${natal.midheaven.degree.toFixed(1)}°
- Natal planets: ${natalPlanets}
- Health blueprint: ${blueprintItems}
- Active transits by weight (use these to inform your responses — higher score = more astrologically significant): ${topTransits || "none"}
`;
  }

  return `You are AstroHealth Oracle, a warm and perceptive personal wellness guide with deep knowledge of medical astrology.
${natalSection}${knowledgeBlock}
Today's sky:
- Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- Moon: ${astro.moonPhase} in ${astro.moonSign}
- Sun in ${astro.sunSign}
- Planets: ${todayPlanets}
- Active transits: ${astro.activeTransits.join("; ")}

Your role:
- Be the user's thoughtful health companion — track supplements, activities, symptoms, mood, and energy with them
- Connect what they share to their natal blueprint AND today's sky — be specific, not generic
- When they describe something ("I took magnesium", "bad headache today", "went for a run"), acknowledge it and suggest how to log it
- Offer wellness guidance grounded in the astrological context — not medical advice, but supportive and insightful
- Reference their natal chart placements naturally and specifically (e.g. "with your 6th house in Sagittarius, liver support and hip mobility are worth watching")

Language and quality rules (always follow these):
- Write grammatically complete sentences. Never produce awkward compound sentences where a clause is embedded inside another.
- Never use vague phrases like "vitality is active," "this is a time of transformation," "pay attention to your body," or "balance is needed."
- When mentioning a transit, always name: the transiting planet, the natal point or house involved, and what domain to track (e.g. "Neptune is forming a square to your natal Moon — sensitivity, hydration, sleep, and emotional overwhelm are worth tracking during this period").
- Do not diagnose. Do not prescribe. Do not say astrology causes symptoms.
- Use language like "may correspond with," "can describe a tendency toward," "is worth tracking," "in your logs, this appears alongside."
- Sound like a thoughtful practitioner having a real conversation — not a horoscope or a clinical report.

Keep responses concise (2–4 sentences unless detail is genuinely needed). Be warm, direct, and genuinely curious about their experience.`;
}

export default router;
