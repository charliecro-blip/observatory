/**
 * Account = tester-id recovery, right-sized for beta.
 *
 * The tester id (localStorage) is the identity every table keys on. These
 * routes give it a server-side profile row and a human-friendly recovery key,
 * so clearing the browser or switching devices no longer means losing
 * everything. No passwords, no email — the key is the secret.
 *
 * POST   /api/account/sync     (x-tester-id) — upsert the profile, returns { recoveryCode }
 * POST   /api/account/recover  { code }      — returns { testerId, profile } for a valid key
 * DELETE /api/account          (x-tester-id) — erase the account and everything keyed to it
 */
import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db, testerProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { mintFeedToken, hashFeedToken } from "../lib/feedToken.js";
import { entitlementFor, TRIAL_DAYS } from "../lib/entitlements.js";
import { claimAccount, mintSessionFor, hashSessionToken, clearSessionCache } from "../lib/accountAuth.js";
import { accountSessions } from "@workspace/db";
import { requireTesterId } from "../middlewares/testerId.js";
import { requireFeature } from "../middlewares/entitlement.js";
import { natalCharts, rhythmDays, dailyCheckIns, wins, habitLogs, tasks } from "@workspace/db";
import { and, gte, desc } from "drizzle-orm";
import { computeNatalChart } from "../lib/natal.js";
import { proposeRhythm, currentGear } from "../lib/rhythmProposal.js";
import { deleteAccount } from "../lib/accountDeletion.js";

const router: IRouter = Router();

// Unambiguous alphabet — no 0/O, 1/I/L — so the key survives handwriting.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateRecoveryCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `TIDE-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("TIDE") ? cleaned.slice(4) : cleaned;
  return `TIDE-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

router.post("/account/sync", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { displayName, chronotype, cautionPlanets, lat, lon, locationLabel, prefs } = req.body ?? {};

  const existing = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;

  const fields = {
    displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim() : (existing?.displayName ?? "Observer"),
    chronotype: chronotype ?? existing?.chronotype ?? null,
    cautionPlanets: cautionPlanets ?? existing?.cautionPlanets ?? null,
    lat: lat != null ? String(lat) : (existing?.lat ?? null),
    lon: lon != null ? String(lon) : (existing?.lon ?? null),
    locationLabel: locationLabel ?? existing?.locationLabel ?? null,
    prefs: prefs ?? existing?.prefs ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(testerProfiles).set(fields).where(eq(testerProfiles.testerId, testerId));
    // Deliberately does NOT return the recovery code. The client is sent it
    // once, at creation, and keeps its own copy; re-issuing it on every sync
    // made the tester id equivalent to the key it is supposed to protect —
    // anyone holding an id could ask for the code and restore the account
    // anywhere. Someone who has lost their key can no longer mint a new one
    // from an id alone; they contact us.
    res.json({ ok: true });
    return;
  }

  // Collisions on an 8-char/31-alphabet code are vanishingly rare; retry a
  // couple of times anyway since the column is unique.
  for (let attempt = 0; attempt < 3; attempt++) {
    const recoveryCode = generateRecoveryCode();
    try {
      await db.insert(testerProfiles).values({ testerId, recoveryCode, ...fields });
      // A NEW account is claimed from birth: its first sync mints the session
      // right here, so a signup never spends a moment in the unclaimed state
      // where a bare id is a working credential. The TOFU window exists only
      // for accounts that predate sessions.
      const sessionToken = await mintSessionFor(testerId, "signup");
      res.status(201).json({ recoveryCode, sessionToken });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
});

/**
 * Trust-on-first-use claim, for accounts that predate sessions.
 *
 * The client calls this on boot when it holds an identity but no token. The
 * first claimer owns the account; everyone after — normally the same person's
 * other device — gets 403 and proves themselves with the recovery code they
 * already hold (POST /account/recover mints their session). NOT behind the
 * session gate, per middlewares/session.ts EXEMPT: this is how a token is
 * obtained.
 *
 * Past the TOFU deadline it stops issuing anything (410). That is the half of
 * the close that is easy to forget: this route is exempt from the gate, so a
 * gate that refuses unclaimed ids while this still hands out sessions for them
 * has moved the hole rather than filled it.
 */
router.post("/account/claim", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const result = await claimAccount(testerId);
  if (!result.ok) {
    if (result.reason === "no-profile") {
      res.status(404).json({ error: "no_profile", message: "Sync the account first." });
      return;
    }
    if (result.reason === "window-closed") {
      // 410, not 403: the difference is "someone else has it" versus "this
      // door no longer exists". Both send the client to the same repair, and
      // the client treats every non-404 refusal alike — but the log should say
      // which one happened, because a burst of these is testers coming back
      // and a burst of 403s is two devices racing.
      res.status(410).json({ error: "claim_window_closed" });
      return;
    }
    res.status(403).json({ error: "already_claimed" });
    return;
  }
  res.json({ sessionToken: result.token });
});

router.post("/account/recover", async (req, res) => {
  const rawCode = (req.body?.code as string) ?? "";
  if (rawCode.replace(/[^A-Za-z0-9]/g, "").length < 8) {
    res.status(400).json({ error: "invalid_code", message: "That doesn't look like a full account key." });
    return;
  }
  const code = normalizeCode(rawCode);
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.recoveryCode, code)).limit(1))[0] ?? null;
  if (!row) {
    res.status(404).json({ error: "not_found", message: "No account matches that key — check it character by character." });
    return;
  }
  // The recovery code is proof of ownership, so recovering also mints this
  // device its own session — and claims the account if nothing had yet. This
  // is what makes the second device's migration silent: it holds the code in
  // localStorage from an earlier sync, hits the claim 403, and lands here.
  const sessionToken = await mintSessionFor(row.testerId, "recovery");
  res.json({
    testerId: row.testerId,
    sessionToken,
    profile: {
      displayName: row.displayName,
      chronotype: row.chronotype,
      cautionPlanets: row.cautionPlanets,
      lat: row.lat != null ? parseFloat(row.lat) : undefined,
      lon: row.lon != null ? parseFloat(row.lon) : undefined,
      locationLabel: row.locationLabel ?? undefined,
      recoveryCode: row.recoveryCode,
    },
  });
});

// ── Sessions — the devices signed into this account ─────────────────────────
// Behind the session gate like everything else, so only a device holding a
// valid token can see or revoke the others. The token itself never appears
// here; rows are identified by id, described by origin and timestamps.

/** List, with THIS device marked — matched by the presented token's hash. */
router.get("/account/sessions", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const presented = (() => {
    const t = req.headers["x-session-token"];
    const v = (Array.isArray(t) ? t[0] : t)?.trim();
    return v ? hashSessionToken(v) : null;
  })();
  const rows = await db.select().from(accountSessions)
    .where(eq(accountSessions.testerId, testerId));
  res.json({
    sessions: rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        origin: r.origin,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        current: presented != null && r.tokenHash === presented,
      })),
  });
});

/**
 * Revoke one session. The CURRENT one is refused: this device holds the
 * recovery code, so a self-revoke would be theater — the next 401 self-heals
 * a fresh session automatically. Signing out other devices is the real
 * capability, and it takes effect within the verdict cache's sixty seconds.
 */
router.delete("/account/sessions/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad_id" }); return; }
  const presented = (() => {
    const t = req.headers["x-session-token"];
    const v = (Array.isArray(t) ? t[0] : t)?.trim();
    return v ? hashSessionToken(v) : null;
  })();
  const row = (await db.select().from(accountSessions)
    .where(eq(accountSessions.id, id)).limit(1))[0];
  if (!row || row.testerId !== testerId) { res.status(404).json({ error: "not_found" }); return; }
  if (presented != null && row.tokenHash === presented) {
    res.status(400).json({ error: "cannot_revoke_current" });
    return;
  }
  await db.delete(accountSessions).where(eq(accountSessions.id, id));
  clearSessionCache();
  res.json({ ok: true });
});

// ── Calendar-feed token ──────────────────────────────────────────────────────
// A separate, revocable secret scoped ONLY to the iCal route. See
// lib/feedToken.ts for why this is not simply the tester id.

/** Current state — never returns the token itself; it exists once, at issue. */
router.get("/account/feed-token", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
  res.json({
    active: !!row?.feedTokenHash,
    createdAt: row?.feedTokenCreatedAt ?? null,
    lastUsedAt: row?.feedTokenLastUsedAt ?? null,
  });
});

/** Issue or regenerate. Returns the secret ONCE — regenerating kills the old link. */
router.post("/account/feed-token", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
  if (!row) { res.status(404).json({ error: "No profile — sync first." }); return; }
  const token = mintFeedToken();
  await db.update(testerProfiles).set({
    feedTokenHash: hashFeedToken(token),
    feedTokenCreatedAt: new Date(),
    feedTokenLastUsedAt: null,
  }).where(eq(testerProfiles.testerId, testerId));
  res.json({ token });
});

/** Revoke. Any calendar still subscribed starts 404-ing, which is the point. */
router.delete("/account/feed-token", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  await db.update(testerProfiles).set({
    feedTokenHash: null, feedTokenCreatedAt: null, feedTokenLastUsedAt: null,
  }).where(eq(testerProfiles.testerId, testerId));
  res.json({ ok: true });
});

// ── Deletion ─────────────────────────────────────────────────────────────────
// The privacy policy promises this; until now it was kept by hand over email.
//
// The tester id is the only credential in this system, so it is what authorises
// the delete — but a bearer token that can also *destroy* everything on a bare
// DELETE is a footgun (a stray prefetch, a mis-scoped script, a copied curl).
// The client must additionally echo the exact phrase, which no accidental
// request will carry. It is a deliberateness check, not a second factor; the
// real confirmation is the typed word in the UI.
const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

router.delete("/account", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const confirm = typeof req.body?.confirm === "string" ? req.body.confirm.trim().toUpperCase() : "";
  if (confirm !== DELETE_CONFIRMATION) {
    res.status(400).json({
      error: "confirmation_required",
      message: `Send { "confirm": "${DELETE_CONFIRMATION}" } to delete this account.`,
    });
    return;
  }

  try {
    const report = await deleteAccount(testerId);
    res.json({
      ok: true,
      rowsDeleted: report.totalRows,
      tables: report.deleted,
      // Reported honestly rather than assumed: null = nothing was connected,
      // false = Google refused or was unreachable and the user should revoke
      // manually. Claiming a revocation we didn't get is exactly the kind of
      // quiet lie a deletion flow must not tell.
      googleRevoked: report.googleRevoked,
    });
  } catch (e) {
    // A failed transaction leaves the account intact, which is the safe end of
    // the failure — say so, so the user retries instead of assuming they're gone.
    res.status(500).json({
      error: "deletion_failed",
      message: "Nothing was deleted — the whole operation is one transaction, so your account is untouched. Try again, or email charliecro@gmail.com.",
    });
    throw e;
  }
});

/**
 * PREFERENCES, ACROSS DEVICES.
 *
 * Preferences were localStorage-only, so on the per-device session model a
 * lens or a layout set on one device did not exist on the person's other one
 * (audit 2026-08-19 §7). The client keeps localStorage as its synchronous
 * source — it must render the first frame at the right density without
 * waiting for a round trip — and treats this as the copy that follows it to a
 * new device.
 *
 * LAST WRITE WINS, deliberately. Merging two devices' preference objects
 * field by field would silently produce a third state neither person chose;
 * for a settings blob whose shape the client owns, the newer whole object is
 * the honest answer. The client sends the WHOLE object for the same reason.
 *
 * Absent is a real answer here, not a failure: a profile that has never
 * synced returns `{ prefs: null }` and the client keeps its local defaults.
 */
router.get("/account/prefs", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select({ prefs: testerProfiles.prefs, updatedAt: testerProfiles.updatedAt })
    .from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;
  res.json({ prefs: row?.prefs ?? null, updatedAt: row?.updatedAt ?? null });
});

router.put("/account/prefs", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const prefs = req.body?.prefs;
  if (prefs == null || typeof prefs !== "object" || Array.isArray(prefs)) {
    res.status(400).json({ error: "prefs must be an object" });
    return;
  }
  // A settings blob has no business being large. The cap is a guard against a
  // client bug filling the column, not a schema the server pretends to know:
  // validating the SHAPE here would mean two definitions of it, and the one
  // that matters lives in the client that reads it back.
  if (JSON.stringify(prefs).length > 20_000) {
    res.status(413).json({ error: "preferences too large" });
    return;
  }
  const updated = await db.update(testerProfiles)
    .set({ prefs, updatedAt: new Date() })
    .where(eq(testerProfiles.testerId, testerId))
    .returning({ testerId: testerProfiles.testerId });
  // No profile yet means this device has never synced. Say so rather than
  // inserting a bare row: a profile is created by /account/sync, which is
  // also what mints the recovery code, and a half-made account here would be
  // an account without one.
  if (!updated.length) { res.status(404).json({ error: "no profile yet" }); return; }
  res.json({ ok: true });
});

/**
 * WHAT THIS ACCOUNT CAN DO.
 *
 * One definition, on the server, asked for by the client — rather than two
 * copies of the free/paid line drifting apart. The client renders doors from
 * this; the guards enforce it. Both read the same function.
 */
router.get("/account/entitlements", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select({ plan: testerProfiles.plan, trialEndsAt: testerProfiles.trialEndsAt })
    .from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;
  res.json(entitlementFor(row));
});

/**
 * START THE 30-DAY TRIAL. Idempotent, and it never restarts one.
 *
 * A person who has already had their trial gets `already: true` and their
 * existing dates back rather than a fresh month — otherwise the endpoint is
 * a free subscription for anyone who calls it twice. Nothing here takes a
 * payment method: the trial is the product making its case, and asking for a
 * card first is asking to be trusted before being useful.
 */
router.post("/account/trial", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;
  if (!row) { res.status(404).json({ error: "no profile yet" }); return; }
  if (row.trialEndsAt) {
    res.json({ already: true, ...entitlementFor(row) });
    return;
  }
  const ends = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  await db.update(testerProfiles)
    .set({ plan: "trial", trialEndsAt: ends, planUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(testerProfiles.testerId, testerId));
  res.status(201).json({ already: false, ...entitlementFor({ plan: "trial", trialEndsAt: ends }) });
});

export default router;


// ── Working rhythm: the chart's proposal, the sky's gear, the record ─────────
// DESIGN-WORKING-RHYTHM-2026-08-21 §2, §3, §7 steps 2–4. The chart is the
// prior; behavior is the posterior. Everything here is offered, never applied.

async function chartFor(testerId: string) {
  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored?.birthDate || stored.birthTime == null) return null;
  return computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
}

/** GET /account/rhythm-proposal — per-function trims read off the natal chart. */
router.get("/account/rhythm-proposal", requireTesterId, requireFeature("rhythm.astro"), async (_req, res) => {
  const testerId = res.locals.testerId as string;
  try {
    const natal = await chartFor(testerId);
    if (!natal) { res.json({ available: false, reason: "no-chart" }); return; }
    const proposal = proposeRhythm(natal);
    if (!proposal) { res.json({ available: false, reason: "incomplete-chart" }); return; }
    res.json({ available: true, proposal });
  } catch {
    res.status(503).json({ error: "could not read the chart" });
  }
});

/** GET /account/gear — the transit, if any, lighting one working style now. */
/**
 * Days on which this person recorded ANYTHING — not a streak, which resets,
 * and not account age, which counts days nobody opened the app.
 */
async function daysRecorded(testerId: string): Promise<number> {
  const [checks, logs, winRows, taskRows] = await Promise.all([
    db.select({ d: dailyCheckIns.date }).from(dailyCheckIns).where(eq(dailyCheckIns.testerId, testerId)),
    db.select({ d: habitLogs.date }).from(habitLogs).where(eq(habitLogs.testerId, testerId)),
    db.select({ d: wins.date }).from(wins).where(eq(wins.testerId, testerId)),
    db.select({ d: tasks.createdAt }).from(tasks).where(eq(tasks.testerId, testerId)),
  ]);
  const days = new Set<string>();
  for (const r of [...checks, ...logs, ...winRows]) if (r.d) days.add(String(r.d).slice(0, 10));
  // Tasks carry a timestamp rather than a day. Sliced in UTC, which can put a
  // late-evening task on tomorrow — acceptable here, where the number only has
  // to cross a threshold of seven and is never shown as a date.
  for (const r of taskRows) if (r.d) days.add(new Date(r.d).toISOString().slice(0, 10));
  return days.size;
}

/**
 * How much use earns the gear change. Measured rather than picked: across the
 * profiles in production on 2026-08-23, the two accounts in real daily use sat
 * at 14 and 11 recorded days and every other profile at 5 or fewer — a friend
 * who took the tour and left has exactly 1. Seven falls in that gap, and says
 * a plain thing: about a week of actually using it.
 */
const GEAR_MIN_DAYS = 7;

router.get("/account/gear", requireTesterId, requireFeature("rhythm.astro"), async (_req, res) => {
  const testerId = res.locals.testerId as string;
  try {
    const natal = await chartFor(testerId);
    if (!natal) { res.json({ available: false, reason: "no-chart", gear: null }); return; }
    // "Saturn square your Ascendant · 2.7°" is a sentence for someone who has
    // a rhythm to interrupt. On a first session it is jargon arriving before
    // the thing it modifies, so it waits — and says it is waiting rather than
    // returning a bare no (owner 2026-08-23).
    const days = await daysRecorded(testerId);
    if (days < GEAR_MIN_DAYS) {
      res.json({ available: false, reason: "too-new", daysRecorded: days, needs: GEAR_MIN_DAYS, gear: null });
      return;
    }
    res.json({ available: true, daysRecorded: days, gear: currentGear(natal) });
  } catch {
    res.status(503).json({ error: "could not read the sky" });
  }
});

/** PUT /account/rhythm-day { date, rhythm } — which rhythm Home led with today. */
router.put("/account/rhythm-day", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { date, rhythm } = req.body ?? {};
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["tide", "campaign", "route", "field"].includes(rhythm)) {
    res.status(400).json({ error: "date (YYYY-MM-DD) and rhythm (tide|campaign|route|field) required" });
    return;
  }
  await db.insert(rhythmDays).values({ testerId, date, rhythm })
    .onConflictDoUpdate({ target: [rhythmDays.testerId, rhythmDays.date], set: { rhythm } });
  res.json({ ok: true });
});

/**
 * GET /account/rhythm-audit — the record, grouped by the rhythm in force.
 * A suggestion appears only when both the current rhythm and a rival have
 * enough rated days to compare, and the rival's share of aligned days is
 * clearly higher. The person can prove Compass wrong; that is the feature.
 */
router.get("/account/rhythm-audit", requireTesterId, requireFeature("history.patterns"), async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const days = await db.select().from(rhythmDays).where(and(eq(rhythmDays.testerId, testerId), gte(rhythmDays.date, since))).orderBy(desc(rhythmDays.date));
  if (!days.length) { res.json({ enough: false, rows: [], current: null, suggestion: null }); return; }
  const checkIns = await db.select({ date: dailyCheckIns.date, tags: dailyCheckIns.behaviorTags })
    .from(dailyCheckIns).where(and(eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, since)));
  const feltByDate = new Map<string, string>();
  for (const c of checkIns) {
    const felt = (c.tags ?? []).find((t: string) => t.startsWith("felt:"))?.slice(5);
    if (felt) feltByDate.set(c.date, felt);
  }
  const winRows = await db.select({ date: wins.date }).from(wins).where(and(eq(wins.testerId, testerId), gte(wins.date, since)));
  const winsByDate = new Map<string, number>();
  for (const w of winRows) winsByDate.set(w.date, (winsByDate.get(w.date) ?? 0) + 1);

  const rows = new Map<string, { rhythm: string; days: number; rated: number; aligned: number; mixed: number; off: number; wins: number }>();
  for (const d of days) {
    const r = rows.get(d.rhythm) ?? { rhythm: d.rhythm, days: 0, rated: 0, aligned: 0, mixed: 0, off: 0, wins: 0 };
    r.days++;
    const felt = feltByDate.get(d.date);
    if (felt) { r.rated++; if (felt === "aligned") r.aligned++; else if (felt === "mixed") r.mixed++; else if (felt === "off") r.off++; }
    r.wins += winsByDate.get(d.date) ?? 0;
    rows.set(d.rhythm, r);
  }
  const current = days[0].rhythm;
  const cur = rows.get(current)!;
  const MIN_DAYS = 7, MIN_RATED = 5, MARGIN = 0.2;
  let suggestion: { rhythm: string; alignedShare: number; currentShare: number; days: number } | null = null;
  if (cur.rated >= MIN_RATED) {
    const curShare = cur.aligned / cur.rated;
    for (const r of rows.values()) {
      if (r.rhythm === current || r.days < MIN_DAYS || r.rated < MIN_RATED) continue;
      const share = r.aligned / r.rated;
      if (share - curShare >= MARGIN && (!suggestion || share > suggestion.alignedShare)) {
        suggestion = { rhythm: r.rhythm, alignedShare: share, currentShare: curShare, days: r.days };
      }
    }
  }
  res.json({ enough: [...rows.values()].some(r => r.days >= MIN_DAYS), rows: [...rows.values()], current, suggestion });
});
