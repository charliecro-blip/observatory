import { Router, type IRouter } from "express";
import { db, cultivations, cultivationCheckIns, CULTIVATION_ELEMENTS } from "@workspace/db";
import type { CultivationElement } from "@workspace/db";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

// ── Element mapping ─────────────────────────────────────────────────────────────

/** Domain → multi-element mapping. Source of truth for auto-derivation. */
const DOMAIN_ELEMENTS_MAP: Record<string, CultivationElement[]> = {
  "spiritual-practice": ["spirit"],
  movement:             ["fire", "earth"],
  energy:               ["fire"],
  "creative-practice":  ["water", "spirit"],
  digestion:            ["earth"],
  "food-rhythm":        ["earth"],
  recovery:             ["earth", "water"],
  "pain-tension":       ["earth"],
  "nervous-system":     ["air"],
  "study-learning":     ["air"],
  "social-rhythm":      ["air", "water"],
  boundaries:           ["air"],
  sleep:                ["water"],
  mood:                 ["water"],
};

/**
 * Derive the elements array for a cultivation.
 * - If valid explicit elements provided: use them.
 * - Otherwise: derive from domain.
 */
function deriveElements(
  domain: string,
  explicitElements: string[] | null | undefined,
): CultivationElement[] {
  if (Array.isArray(explicitElements) && explicitElements.length > 0) {
    const valid = explicitElements.filter(
      (e) => (CULTIVATION_ELEMENTS as readonly string[]).includes(e),
    ) as CultivationElement[];
    if (valid.length > 0) return valid;
  }
  return DOMAIN_ELEMENTS_MAP[domain] ?? ["earth"];
}

/**
 * Get the resolved elements for a cultivation row.
 * Prefer the stored `elements` array; fall back to single `element`; then derive from domain.
 */
function getPracticeElements(c: {
  elements: unknown;
  element: string | null;
  domain: string;
}): CultivationElement[] {
  const stored = c.elements as CultivationElement[] | null;
  if (stored && stored.length > 0) return stored;
  if (c.element && (CULTIVATION_ELEMENTS as readonly string[]).includes(c.element)) {
    return [c.element as CultivationElement];
  }
  return DOMAIN_ELEMENTS_MAP[c.domain] ?? ["earth"];
}

// ── Date helpers ────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function startOfRange(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().split("T")[0];
}

// ── GET /api/cultivations — list with embedded today check-in ─────────────────

router.get("/cultivations", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const statusFilter = req.query.status as string | undefined;
  const today = todayString();

  const conditions = [eq(cultivations.testerId, testerId)];
  if (statusFilter) conditions.push(eq(cultivations.status, statusFilter));

  const rows = await db.select().from(cultivations)
    .where(and(...conditions))
    .orderBy(desc(cultivations.createdAt));

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  const todayCheckIns = await db.select().from(cultivationCheckIns)
    .where(and(
      eq(cultivationCheckIns.testerId, testerId),
      eq(cultivationCheckIns.date, today),
    ));

  const ciMap = new Map(todayCheckIns.map((ci) => [ci.cultivationId, ci]));

  res.json(rows.map((c) => ({ ...c, todayCheckIn: ciMap.get(c.id) ?? null })));
});

// ── POST /api/cultivations ──────────────────────────────────────────────────────

router.post("/cultivations", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const {
    title, domain, element, elements, description, relatedPlanet, relatedHouse,
    relatedBodyWeatherTags, targetPractice, frequency, status,
  } = req.body;

  if (!title?.trim() || !domain?.trim()) {
    res.status(400).json({ error: "title and domain are required" });
    return;
  }

  // Accept explicit elements array; fall back to single element; then derive from domain.
  const rawElements: string[] | undefined =
    Array.isArray(elements) && elements.length > 0 ? elements
    : element ? [element]
    : undefined;

  const resolvedElements = deriveElements(domain, rawElements);
  const resolvedElement = resolvedElements[0] ?? null;

  const [inserted] = await db.insert(cultivations).values({
    testerId,
    title: title.trim(),
    domain,
    element: resolvedElement,
    elements: resolvedElements,
    description: description ?? null,
    relatedPlanet: relatedPlanet ?? null,
    relatedHouse: relatedHouse ?? null,
    relatedBodyWeatherTags: relatedBodyWeatherTags ?? null,
    targetPractice: targetPractice ?? null,
    frequency: frequency ?? "daily",
    status: status ?? "active",
  }).returning();

  res.status(201).json(inserted);
});

// ── GET /api/cultivations/element-balance ──────────────────────────────────────
// Must be registered before /:id routes.

router.get("/cultivations/element-balance", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const daysParam = parseInt((req.query.days as string) ?? "7", 10);
  const days = daysParam === 30 ? 30 : 7;

  const endDate = todayString();
  const startDate = startOfRange(days);

  const activeCultivations = await db.select().from(cultivations)
    .where(and(eq(cultivations.testerId, testerId), eq(cultivations.status, "active")));

  type ElementKey = CultivationElement | "unassigned";
  const tally: Record<ElementKey, { tended: number; total: number }> = {
    fire:       { tended: 0, total: 0 },
    earth:      { tended: 0, total: 0 },
    air:        { tended: 0, total: 0 },
    water:      { tended: 0, total: 0 },
    spirit:     { tended: 0, total: 0 },
    unassigned: { tended: 0, total: 0 },
  };

  if (activeCultivations.length === 0) {
    res.json(tally);
    return;
  }

  for (const c of activeCultivations) {
    const keys = getPracticeElements(c);
    if (keys.length === 0) {
      tally.unassigned.total += days;
    } else {
      for (const key of keys) {
        tally[key].total += days;
      }
    }
  }

  const ids = activeCultivations.map((c) => c.id);
  const tendedCheckIns = await db.select({
    cultivationId: cultivationCheckIns.cultivationId,
  }).from(cultivationCheckIns)
    .where(and(
      eq(cultivationCheckIns.testerId, testerId),
      inArray(cultivationCheckIns.cultivationId, ids),
      gte(cultivationCheckIns.date, startDate),
      lte(cultivationCheckIns.date, endDate),
      eq(cultivationCheckIns.completed, true),
    ));

  const elementsById = new Map<number, CultivationElement[]>(
    activeCultivations.map((c) => [c.id, getPracticeElements(c)]),
  );

  for (const ci of tendedCheckIns) {
    const keys = elementsById.get(ci.cultivationId) ?? [];
    if (keys.length === 0) {
      tally.unassigned.tended += 1;
    } else {
      for (const key of keys) {
        tally[key].tended += 1;
      }
    }
  }

  res.json(tally);
});

// ── GET /api/cultivations/element-report ───────────────────────────────────────
// Per-practice session counts in a date range. Range: 7d | 30d | all.
// Must be registered before /:id routes.

router.get("/cultivations/element-report", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const rangeParam = (req.query.range as string) ?? "7d";
  const range = (["7d", "30d", "all"] as const).includes(rangeParam as "7d" | "30d" | "all")
    ? (rangeParam as "7d" | "30d" | "all")
    : "7d";

  const endDate = todayString();
  const startDate = range === "7d" ? startOfRange(7) : range === "30d" ? startOfRange(30) : null;

  const allCultivations = await db.select().from(cultivations)
    .where(eq(cultivations.testerId, testerId));

  if (allCultivations.length === 0) {
    res.json({ range, startDate, endDate, practices: [] });
    return;
  }

  const ids = allCultivations.map((c) => c.id);

  const conditions: ReturnType<typeof eq>[] = [
    eq(cultivationCheckIns.testerId, testerId),
    inArray(cultivationCheckIns.cultivationId, ids),
    eq(cultivationCheckIns.completed, true),
  ];
  if (startDate) {
    conditions.push(gte(cultivationCheckIns.date, startDate) as ReturnType<typeof eq>);
    conditions.push(lte(cultivationCheckIns.date, endDate) as ReturnType<typeof eq>);
  }

  const checkins = await db.select({
    cultivationId: cultivationCheckIns.cultivationId,
  }).from(cultivationCheckIns).where(and(...conditions));

  const sessionCounts = new Map<number, number>();
  for (const ci of checkins) {
    sessionCounts.set(ci.cultivationId, (sessionCounts.get(ci.cultivationId) ?? 0) + 1);
  }

  const practices = allCultivations.map((c) => ({
    cultivationId: c.id,
    title: c.title,
    domain: c.domain,
    elements: getPracticeElements(c),
    status: c.status,
    sessions: sessionCounts.get(c.id) ?? 0,
  }));

  res.json({ range, startDate, endDate, practices });
});

// ── PATCH /api/cultivations/:id ────────────────────────────────────────────────

router.patch("/cultivations/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);

  const existing = (await db.select().from(cultivations)
    .where(and(eq(cultivations.id, id), eq(cultivations.testerId, testerId)))
    .limit(1))[0] ?? null;

  if (!existing) {
    res.status(404).json({ error: "Cultivation not found" });
    return;
  }

  const {
    title, domain, element, elements, description, relatedPlanet, relatedHouse,
    relatedBodyWeatherTags, targetPractice, frequency, status,
  } = req.body;

  const updates: Partial<typeof cultivations.$inferSelect> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (domain !== undefined) updates.domain = domain;
  if (description !== undefined) updates.description = description;
  if (relatedPlanet !== undefined) updates.relatedPlanet = relatedPlanet;
  if (relatedHouse !== undefined) updates.relatedHouse = relatedHouse;
  if (relatedBodyWeatherTags !== undefined) updates.relatedBodyWeatherTags = relatedBodyWeatherTags;
  if (targetPractice !== undefined) updates.targetPractice = targetPractice;
  if (frequency !== undefined) updates.frequency = frequency;
  if (status !== undefined) updates.status = status;

  // Resolve element/elements for update
  const effectiveDomain = updates.domain ?? existing.domain;
  if (elements !== undefined && Array.isArray(elements)) {
    const resolved = deriveElements(effectiveDomain, elements);
    updates.elements = resolved;
    updates.element = resolved[0] ?? null;
  } else if (element !== undefined) {
    const resolved = deriveElements(effectiveDomain, element ? [element] : []);
    updates.elements = resolved;
    updates.element = resolved[0] ?? null;
  } else if (domain !== undefined && domain !== existing.domain) {
    // Domain changed, no explicit element — re-derive for new domain
    const resolved = deriveElements(domain, undefined);
    updates.elements = resolved;
    updates.element = resolved[0] ?? null;
  }

  const [updated] = await db.update(cultivations).set(updates).where(eq(cultivations.id, id)).returning();
  res.json(updated);
});

// ── DELETE /api/cultivations/:id ───────────────────────────────────────────────

router.delete("/cultivations/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);

  const existing = (await db.select().from(cultivations)
    .where(and(eq(cultivations.id, id), eq(cultivations.testerId, testerId)))
    .limit(1))[0] ?? null;

  if (!existing) {
    res.status(404).json({ error: "Cultivation not found" });
    return;
  }

  await db.delete(cultivationCheckIns).where(eq(cultivationCheckIns.cultivationId, id));
  await db.delete(cultivations).where(eq(cultivations.id, id));
  res.status(204).send();
});

// ── GET /api/cultivations/:id/check-ins/today ──────────────────────────────────

router.get("/cultivations/:id/check-ins/today", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const cultivationId = parseInt(req.params.id as string, 10);
  const today = todayString();

  const row = (await db.select().from(cultivationCheckIns)
    .where(and(
      eq(cultivationCheckIns.testerId, testerId),
      eq(cultivationCheckIns.cultivationId, cultivationId),
      eq(cultivationCheckIns.date, today),
    ))
    .limit(1))[0] ?? null;

  if (!row) {
    res.status(404).json({ error: "No check-in for today" });
    return;
  }

  res.json(row);
});

// ── GET /api/cultivations/:id/check-ins — history ──────────────────────────────

router.get("/cultivations/:id/check-ins", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const cultivationId = parseInt(req.params.id as string, 10);

  if (isNaN(cultivationId)) {
    res.status(400).json({ error: "Invalid cultivation id" });
    return;
  }

  const daysParam = parseInt((req.query.days as string) ?? "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 90);
  const startDate = startOfRange(days);
  const endDate = todayString();

  const owner = (await db.select({ id: cultivations.id }).from(cultivations)
    .where(and(eq(cultivations.id, cultivationId), eq(cultivations.testerId, testerId)))
    .limit(1))[0] ?? null;

  if (!owner) {
    res.status(404).json({ error: "Cultivation not found" });
    return;
  }

  const rows = await db.select().from(cultivationCheckIns)
    .where(and(
      eq(cultivationCheckIns.testerId, testerId),
      eq(cultivationCheckIns.cultivationId, cultivationId),
      gte(cultivationCheckIns.date, startDate),
      lte(cultivationCheckIns.date, endDate),
    ))
    .orderBy(desc(cultivationCheckIns.date));

  res.json(rows);
});

// ── POST /api/cultivations/:id/check-ins — upsert check-in ────────────────────

router.post("/cultivations/:id/check-ins", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const cultivationId = parseInt(req.params.id as string, 10);
  const { completed, effortLevel, note, date, practicesCompleted, durationMinutes } = req.body;
  const checkInDate = date ?? todayString();

  const today = todayString();
  const thirtyDaysAgo = startOfRange(30);
  if (checkInDate > today) {
    res.status(400).json({ error: "Cannot log a future date" });
    return;
  }
  if (checkInDate < thirtyDaysAgo) {
    res.status(400).json({ error: "Cannot log more than 30 days in the past" });
    return;
  }

  const hasSubPractices = Array.isArray(practicesCompleted) && practicesCompleted.length > 0;
  const resolvedCompleted = completed !== undefined
    ? Boolean(completed)
    : hasSubPractices
      ? true
      : false;

  const existing = (await db.select().from(cultivationCheckIns)
    .where(and(
      eq(cultivationCheckIns.testerId, testerId),
      eq(cultivationCheckIns.cultivationId, cultivationId),
      eq(cultivationCheckIns.date, checkInDate),
    ))
    .limit(1))[0] ?? null;

  let row: typeof cultivationCheckIns.$inferSelect;

  if (existing) {
    const [updated] = await db.update(cultivationCheckIns).set({
      completed: resolvedCompleted,
      effortLevel: effortLevel !== undefined ? effortLevel : existing.effortLevel,
      note: note !== undefined ? note : existing.note,
      practicesCompleted: practicesCompleted !== undefined
        ? (practicesCompleted as string[] | null)
        : existing.practicesCompleted,
      durationMinutes: durationMinutes !== undefined
        ? (durationMinutes as number | null)
        : existing.durationMinutes,
      updatedAt: new Date(),
    }).where(eq(cultivationCheckIns.id, existing.id)).returning();
    row = updated;
  } else {
    const [inserted] = await db.insert(cultivationCheckIns).values({
      testerId,
      cultivationId,
      date: checkInDate,
      completed: resolvedCompleted,
      effortLevel: effortLevel ?? null,
      note: note ?? null,
      practicesCompleted: practicesCompleted ?? null,
      durationMinutes: durationMinutes ?? null,
    }).returning();
    row = inserted;
  }

  res.json(row);
});

export default router;
