/**
 * READING A CALENDAR THAT ALREADY EXISTS.
 *
 * Everywhere else Compass searches for a window. This points the same
 * evaluator at windows the person has ALREADY committed to and says what the
 * sky is doing then — `evaluateActivityInterval` scores a supplied interval,
 * so no new engine was needed for this, only somewhere to aim it.
 *
 * THREE RULES, agreed with the owner before any of it was built, because each
 * one is the difference between a useful audit and a horoscope with a
 * calendar skin:
 *
 * 1. IT ONLY SPEAKS WHEN ASKED. This is an endpoint you call, never a
 *    decoration on every event. Compass stopped telling people what to do
 *    unprompted on 2026-08-19 and an audit that annotated a whole week by
 *    itself would walk straight back into it.
 *
 * 2. IT WILL NOT GUESS WHAT AN EVENT IS. "Dinner w/ Sam" is not a first date
 *    until somebody says so. A guess here reproduces the exact failure the
 *    owner caught the day before — a Neptune trine offered as "a window for
 *    the Tastes + Temperatures video" because the two shared a lookup table.
 *    So a match is a PROPOSAL carrying its own confidence, and the verdict
 *    only comes once an activity is confirmed.
 *
 * 3. IT IS WILLING TO SAY NOTHING. Most events, most days, have no strong
 *    testimony either way, and the engine has an honest state for that. A
 *    portentous note on every meeting is noise, and noise is how the whole
 *    thing loses its credibility.
 *
 * A fourth follows from the first three: a verdict on something you cannot
 * move is just anxiety. The client decides what is movable — it knows who
 * organised the event — and this route reports rather than nags.
 */

import { Router, type IRouter } from "express";
import { evaluateActivityInterval } from "../lib/electionEngine.js";
import { matchActivity, ACTIVITIES } from "../lib/activityCorrespondences.js";
import { requireTesterId } from "../middlewares/testerId.js";
import { db } from "@workspace/db";
import { eventKinds } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const MAX_EVENTS = 40;

interface IncomingEvent {
  id: string;
  title?: string;
  start: string;
  end?: string;
  /** Set once the person has told us, or confirmed a proposal. Absent means
   *  "unknown", which is a different answer from "nothing notable". */
  activityKey?: string | null;
}

router.post("/calendar/audit", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const events: IncomingEvent[] = Array.isArray(req.body?.events) ? req.body.events : [];
  if (!events.length) { res.json({ readings: [] }); return; }
  if (events.length > MAX_EVENTS) {
    // A cap that SAYS it is a cap. Silently truncating would report a clean
    // week that was never looked at past the fortieth event.
    res.status(413).json({ error: "too_many_events", max: MAX_EVENTS, sent: events.length });
    return;
  }

  // What this person has already told us these events are. Applied before
  // anything is proposed, so a question is never asked twice.
  const known = new Map<string, string | null>();
  const ids = events.map(e => e.id).filter(Boolean);
  if (ids.length) {
    const rows = await db.select().from(eventKinds)
      .where(and(eq(eventKinds.testerId, testerId), inArray(eventKinds.eventId, ids)));
    for (const r of rows) known.set(r.eventId, r.activityKey);
  }

  const readings = events.map((ev) => {
    const startAt = new Date(ev.start);
    const endAt = ev.end ? new Date(ev.end) : new Date(startAt.getTime() + 3600_000);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return { id: ev.id, state: "unreadable" as const, reason: "the times on this event could not be read" };
    }

    // The stored answer wins over anything the caller guessed at.
    const stored = known.has(ev.id) ? known.get(ev.id) : undefined;
    // Explicitly told "none of these" — a real answer, and not the same thing
    // as never having been asked. It must not come back as a question.
    if (stored === null) return { id: ev.id, state: "not-timeable" as const };
    const activityKey = stored ?? ev.activityKey ?? null;

    // ── Confirmed: a real verdict, with the reasons that produced it.
    if (activityKey) {
      const a = evaluateActivityInterval({ activityKey, startAt, endAt });
      if (!a) return { id: ev.id, state: "unknown-activity" as const, activityKey };
      // TWO AXES, and "nothing notable" is a real answer on both.
      //
      // `suitability` is clear | qualified | defer — whether anything argues
      // against this interval. `supportLevel` is supported | convergent — how
      // much independent testimony agrees. A clear interval with no
      // convergence is precisely the ordinary case, and saying so plainly is
      // what keeps this from being a portent on every meeting.
      const quiet = a.suitability === "clear" && a.families.length === 0;
      return {
        id: ev.id,
        state: quiet ? ("quiet" as const) : ("assessed" as const),
        activityKey,
        suitability: a.suitability,
        supportLevel: a.supportLevel,
        backgroundFit: a.backgroundFit,
        // The reasons ARE the answer. A verdict without them is an opinion,
        // and evidence-is-free is load-bearing for the whole pricing line.
        reasons: a.suitabilityReasons.map(r => ({ kind: r.kind, planet: (r as any).planet ?? null })),
        families: a.families,
      };
    }

    // ── Not told yet: propose, and carry the confidence rather than hiding it.
    const guess = ev.title ? matchActivity(ev.title) : null;
    return {
      id: ev.id,
      state: "needs-kind" as const,
      proposal: guess ? { activityKey: guess.activity.key, label: guess.activity.label, score: guess.score } : null,
    };
  });

  res.json({ readings });
});

/**
 * TELL COMPASS WHAT AN EVENT IS — or that it is not the kind of thing timing
 * has anything to say about, which is what `activityKey: null` means here.
 * Saying "none of these" has to be recordable, or the audit asks the same
 * question about the same standing meeting every week.
 */
router.put("/calendar/audit/kind", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { eventId, activityKey, source } = req.body ?? {};
  if (typeof eventId !== "string" || !eventId) { res.status(400).json({ error: "eventId required" }); return; }
  if (activityKey != null && !ACTIVITIES.some((a: any) => a.key === activityKey)) {
    res.status(400).json({ error: "unknown_activity", activityKey });
    return;
  }
  const src = typeof source === "string" && source ? source : "gcal";
  const existing = (await db.select().from(eventKinds)
    .where(and(eq(eventKinds.testerId, testerId), eq(eventKinds.source, src), eq(eventKinds.eventId, eventId)))
    .limit(1))[0] ?? null;
  if (existing) {
    await db.update(eventKinds).set({ activityKey: activityKey ?? null, updatedAt: new Date() })
      .where(eq(eventKinds.id, existing.id));
  } else {
    await db.insert(eventKinds).values({ testerId, source: src, eventId, activityKey: activityKey ?? null });
  }
  res.json({ ok: true, eventId, activityKey: activityKey ?? null });
});

/** The vocabulary a person picks from when they tell Compass what an event is. */
router.get("/calendar/audit/kinds", requireTesterId, (_req, res) => {
  res.json({
    kinds: ACTIVITIES.map((a: any) => ({ key: a.key, label: a.label, group: a.group ?? null })),
  });
});

export default router;
