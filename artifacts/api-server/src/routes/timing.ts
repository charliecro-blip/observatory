import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { db, natalCharts, planningWindows } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { planForTester } from "../middlewares/entitlement.js";
import { can } from "../lib/entitlements.js";
import { computeNatalChart } from "../lib/natal.js";
import { customActivitiesFor } from "./customActivities.js";
import { fetchGcalBusy } from "./googleCal.js";
import { searchTiming, type TimingSearchRequest } from "../lib/timingSearch.js";
import { presentTiming } from "../lib/timingPresentation.js";
import { interpretTimingActivity } from "../lib/timingInterpretation.js";
import { activityByKey } from "../lib/activityCorrespondences.js";
import { timingEnabledFor } from "../lib/timingAccess.js";

const router: IRouter = Router();
router.get("/timing/config", requireTesterId, (_req, res) => {
  res.json({ enabled: timingEnabledFor(res.locals.testerId) });
});
router.use("/timing", requireTesterId, (_req, res, next) => {
  if (!timingEnabledFor(res.locals.testerId)) {
    res.status(404).json({ error: "not_enabled" });
    return;
  }
  next();
});
router.post("/timing/interpret", (req, res) => {
  if (typeof req.body?.text !== "string" || req.body.text.length > 500) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  res.json(interpretTimingActivity(req.body.text));
});

/** Accept only public request fields; never trust caller-provided evidence or charts. */
export function timingInput(body: unknown):
  | (Omit<TimingSearchRequest, "natal" | "calendar" | "extraActivities"> & {
      useNatal: boolean;
      checkCalendar: boolean;
    })
  | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;
  if (
    typeof b.activity !== "string" ||
    b.activity.length > 100 ||
    typeof b.start !== "string" ||
    typeof b.end !== "string" ||
    typeof b.timeZone !== "string"
  )
    return null;
  if (b.durationMinutes !== undefined && typeof b.durationMinutes !== "number")
    return null;
  if (
    b.location !== undefined &&
    (!b.location ||
      typeof b.location.lat !== "number" ||
      typeof b.location.lon !== "number")
  )
    return null;
  return {
    activity: b.activity,
    start: b.start,
    end: b.end,
    timeZone: b.timeZone,
    ...(b.durationMinutes !== undefined
      ? { durationMinutes: b.durationMinutes }
      : {}),
    ...(b.candidateIntervals !== undefined
      ? { candidateIntervals: b.candidateIntervals }
      : {}),
    ...(b.location
      ? { location: { lat: b.location.lat, lon: b.location.lon } }
      : {}),
    useNatal: b.useNatal === true,
    checkCalendar: b.checkCalendar === true,
  };
}
async function computeFor(
  testerId: string,
  input: NonNullable<ReturnType<typeof timingInput>>,
) {
  const plan = await planForTester(testerId);
  if (
    !can(plan, "horizon.week") ||
    (input.durationMinutes && !can(plan, "sessions.long")) ||
    (input.checkCalendar && !can(plan, "placement.calendar"))
  )
    return { error: "upgrade_required" as const };
  const extraActivities = await customActivitiesFor(testerId);
  const q: TimingSearchRequest = { ...input, extraActivities };
  if (input.useNatal) {
    const stored = (
      await db
        .select()
        .from(natalCharts)
        .where(eq(natalCharts.testerId, testerId))
        .limit(1)
    )[0];
    if (stored?.birthDate && stored.birthTime != null)
      q.natal = {
        chart: computeNatalChart(
          stored.birthDate,
          stored.birthTime,
          Number(stored.birthLat),
          Number(stored.birthLon),
          Number(stored.utcOffset),
          "whole-sign",
        ),
        timeKnown: stored.timeKnown !== false,
      };
  }
  // Validate bounded work before attempting calendar I/O. No astronomical scan.
  const validation = searchTiming(q, {
    ordinary: () => null,
    session: () => null,
    comparison: () => null,
  });
  if (validation.status === "invalid" || validation.status === "unsupported")
    return presentTiming(validation);
  if (input.checkCalendar) {
    let result;
    try {
      result = await fetchGcalBusy(testerId, input.start, input.end);
    } catch {
      result = { ok: false, connected: false, busy: [] };
    }
    // An unlinked Google account is not a successful availability check.
    if (!result.connected) result = { ...result, ok: false };
    q.calendar = {
      result,
      source: "Google Calendar",
      fetchedAt: new Date().toISOString(),
    };
  }
  return presentTiming(searchTiming(q));
}
router.post("/timing/search", async (req, res) => {
  const input = timingInput(req.body);
  if (!input) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  try {
    const response = await computeFor(res.locals.testerId, input);
    res.status("error" in response ? 402 : 200).json(response);
  } catch {
    res.status(503).json({ error: "context_unavailable" });
  }
});

router.post("/timing/choose", async (req, res) => {
  const testerId = res.locals.testerId as string;
  const input = timingInput(req.body?.query);
  const { choiceKey, candidateId, title } = req.body ?? {};
  if (
    !input ||
    typeof choiceKey !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(choiceKey) ||
    typeof candidateId !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 500
  ) {
    res.status(400).json({ error: "invalid_choice" });
    return;
  }
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ input, candidateId, title: title.trim() }))
    .digest("hex");
  const existing = async () =>
    (
      await db
        .select()
        .from(planningWindows)
        .where(
          and(
            eq(planningWindows.testerId, testerId),
            eq(planningWindows.choiceKey, choiceKey),
          ),
        )
        .limit(1)
    )[0];
  const reply = (
    row: Awaited<ReturnType<typeof existing>>,
    created = false,
  ) => {
    if (
      !row ||
      (row.timingProvenance as any)?.requestFingerprint !== fingerprint
    ) {
      res.status(409).json({ error: "choice_key_reused" });
      return;
    }
    res
      .status(created ? 201 : 200)
      .json({ window: row, calendar: "not_requested" });
  };
  try {
    const prior = await existing();
    if (prior) {
      reply(prior);
      return;
    }
    const response = await computeFor(testerId, input);
    if ("error" in response) {
      res.status(402).json(response);
      return;
    }
    if (!("days" in response.result)) {
      res.status(400).json(response);
      return;
    }
    const candidate = response.candidates.find((c) => c.id === candidateId);
    if (
      !candidate ||
      candidate.broad ||
      candidate.shortfall ||
      candidate.suitability === "defer" ||
      candidate.availability.status === "conflict" ||
      (input.checkCalendar && candidate.availability.status !== "clear")
    ) {
      res.status(409).json({ error: "choice_needs_review" });
      return;
    }
    const act =
      activityByKey(input.activity) ??
      (await customActivitiesFor(testerId)).find(
        (a) => a.key === input.activity,
      );
    if (!act) {
      res.status(409).json({ error: "choice_needs_review" });
      return;
    }
    const [inserted] = await db
      .insert(planningWindows)
      .values({
        testerId,
        choiceKey,
        title: title.trim(),
        windowType: act.windowType,
        startTime: new Date(candidate.start),
        endTime: new Date(candidate.end),
        timingProvenance: {
          version: 1,
          requestFingerprint: fingerprint,
          interpretation: response.result.interpretation,
          provenance: response.result.provenance,
          context: response.result.context,
          candidate,
          calendarBooking: "not_requested",
        },
      })
      .onConflictDoNothing({
        target: [planningWindows.testerId, planningWindows.choiceKey],
      })
      .returning();
    reply(inserted ?? (await existing()), !!inserted);
  } catch {
    res.status(503).json({ error: "choice_unavailable" });
  }
});
export default router;
