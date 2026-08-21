import { Router, type IRouter } from "express";
import { db, dailyCheckIns } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { UpsertCheckInBody } from "@workspace/api-zod";
import { requireTesterId } from "../middlewares/testerId.js";
// `reflection` is not in the generated UpsertCheckInBody, and a zod object
// strips what it doesn't know — so it is read off the raw body and checked
// here rather than silently dropped. Hand-written because api-server has no
// direct zod dependency, and one field doesn't earn one.
const MAX_ANSWER = 8000;
function cleanReflection(v: unknown): Record<string, unknown> | null | undefined {
  if (v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (o.prompt !== undefined) {
    if (typeof o.prompt !== "string" || o.prompt.length > 400) return undefined;
    out.prompt = o.prompt;
  }
  for (const bag of ["answers", "items"] as const) {
    if (o[bag] === undefined) continue;
    const b = o[bag];
    if (typeof b !== "object" || b === null || Array.isArray(b)) return undefined;
    for (const val of Object.values(b as Record<string, unknown>)) {
      if (typeof val !== "string" || val.length > MAX_ANSWER) return undefined;
    }
    out[bag] = b;
  }
  return out;
}

const router: IRouter = Router();

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/check-ins/today", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  // The client passes its LOCAL date — the server's UTC "today" is a different
  // day for US-evening users (the 8pm-ET rollover bug). UTC stays the fallback
  // for old clients only.
  const today = (req.query.date as string | undefined) ?? todayString();
  const [row] = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), eq(dailyCheckIns.date, today)));
  if (!row) {
    res.status(404).json({ error: "No check-in for today" });
    return;
  }
  res.json(row);
});

router.post("/check-ins", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = UpsertCheckInBody.parse(req.body);
  // A daily record must be stamped with the WRITER's day. The old fallback to
  // the server's UTC date is what filed a US-evening reflection under tomorrow;
  // the callers all send `date` now, and a new one shouldn't be able to
  // reintroduce the bug by forgetting to.
  if (!body.date) {
    res.status(400).json({ error: "date (YYYY-MM-DD, the viewer's local day) is required" });
    return;
  }
  const date = body.date;

  // Partial upsert: only fields present in the body are written. Different
  // surfaces write different slices of the same day (journal → notes,
  // felt-rating → behaviorTags, a scores form → energy/mood/…) and must not
  // null each other out. Send an explicit null to clear a field.
  const FIELDS = [
    "energy", "mood", "stress", "focus", "digestion",
    "sleepQuality", "pain", "regulation", "symptomTags", "behaviorTags", "notes",
  ] as const;
  const provided: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if ((body as Record<string, unknown>)[f] !== undefined) provided[f] = (body as Record<string, unknown>)[f];
  }

  const rawReflection = (req.body as Record<string, unknown>)?.reflection;
  if (rawReflection !== undefined) {
    const cleaned = cleanReflection(rawReflection);
    if (cleaned === undefined) {
      res.status(400).json({ error: "reflection must be { prompt?, answers?, items? } of strings" });
      return;
    }
    provided.reflection = cleaned;
  }

  const [row] = await db
    .insert(dailyCheckIns)
    .values({ testerId, date, ...provided })
    .onConflictDoUpdate({
      target: [dailyCheckIns.testerId, dailyCheckIns.date],
      set: { ...provided, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

// GET /check-ins/felt-pattern?days=30&today=YYYY-MM-DD
//
// The felt loop is the app's trust engine — "your most aligned days have been
// Building days" is the one claim Compass makes that is grounded in the user's
// OWN reported experience rather than in the sky. It was computed by scanning
// localStorage, so it died on any device change or browser clear, taking the
// evidence with it. The data was already here the whole time, mirrored into
// behaviorTags; this reads it back.
//
// The safeguards are the point, not decoration. This is correlational,
// self-reported, small-n data. It may describe a real rhythm, or it may
// describe what the reader expected to feel. So: never claim causation, never
// speak below a minimum sample, always show the counts and the window, and
// always give the comparison — a 70% aligned rate means nothing until you know
// the rate on every other day.
router.get("/check-ins/felt-pattern", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const days = Math.min(180, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today ?? ""))
    ? String(req.query.today) : new Date().toISOString().slice(0, 10);
  const since = (() => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  })();

  const rows = await db.select().from(dailyCheckIns).where(and(
    eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, since),
  ));

  // behaviorTags carry felt:<x> and tideChar:<y> — see the Today reflect loop.
  const tally: Record<string, { aligned: number; total: number }> = {};
  let ratedTotal = 0, ratedAligned = 0;
  let earliest: string | null = null, latest: string | null = null;
  for (const r of rows) {
    const tags = (r.behaviorTags as string[] | null) ?? [];
    const felt = tags.find((t) => t.startsWith("felt:"))?.slice(5);
    if (!felt) continue;
    const chr = tags.find((t) => t.startsWith("tideChar:"))?.slice(9);
    ratedTotal += 1;
    if (felt === "aligned") ratedAligned += 1;
    if (!earliest || r.date < earliest) earliest = r.date;
    if (!latest || r.date > latest) latest = r.date;
    if (!chr) continue;
    tally[chr] ??= { aligned: 0, total: 0 };
    tally[chr].total += 1;
    if (felt === "aligned") tally[chr].aligned += 1;
  }

  // Below this we say nothing at all rather than something shaped like a
  // finding. Four ratings of one character is an anecdote, not a pattern.
  const MIN_PER_CHARACTER = 4;
  const MIN_TOTAL = 10;

  const characters = Object.entries(tally)
    .filter(([, v]) => v.total >= MIN_PER_CHARACTER)
    .map(([character, v]) => ({
      character,
      aligned: v.aligned,
      total: v.total,
      rate: v.aligned / v.total,
      // The comparison that makes the number mean anything: the same rate on
      // every OTHER rated day.
      otherAligned: ratedAligned - v.aligned,
      otherTotal: ratedTotal - v.total,
      otherRate: ratedTotal - v.total > 0 ? (ratedAligned - v.aligned) / (ratedTotal - v.total) : null,
    }))
    .sort((a, b) => b.rate - a.rate);

  res.json({
    enough: ratedTotal >= MIN_TOTAL && characters.length > 0,
    ratedTotal, ratedAligned,
    windowDays: days, since, earliest, latest,
    minPerCharacter: MIN_PER_CHARACTER, minTotal: MIN_TOTAL,
    characters,
  });
});

export default router;
