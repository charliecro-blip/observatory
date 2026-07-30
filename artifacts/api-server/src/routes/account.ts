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
import { requireTesterId } from "../middlewares/testerId.js";
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
  const { displayName, chronotype, cautionPlanets, lat, lon, locationLabel } = req.body ?? {};

  const existing = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;

  const fields = {
    displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim() : (existing?.displayName ?? "Observer"),
    chronotype: chronotype ?? existing?.chronotype ?? null,
    cautionPlanets: cautionPlanets ?? existing?.cautionPlanets ?? null,
    lat: lat != null ? String(lat) : (existing?.lat ?? null),
    lon: lon != null ? String(lon) : (existing?.lon ?? null),
    locationLabel: locationLabel ?? existing?.locationLabel ?? null,
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
      res.status(201).json({ recoveryCode });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
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
  res.json({
    testerId: row.testerId,
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

export default router;
