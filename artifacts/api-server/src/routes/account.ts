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
import { claimAccount, mintSessionFor, hashSessionToken, clearSessionCache } from "../lib/accountAuth.js";
import { accountSessions } from "@workspace/db";
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
 */
router.post("/account/claim", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const result = await claimAccount(testerId);
  if (!result.ok) {
    if (result.reason === "no-profile") {
      res.status(404).json({ error: "no_profile", message: "Sync the account first." });
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

export default router;
