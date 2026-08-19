/**
 * Sessions — the credential the tester id never was.
 *
 * BACKLOG §2 left one item open in the trust sprint: "the middleware still
 * trusts any id presented in the header — closing that properly IS real
 * accounts." This is that closure. The tester id stays the PUBLIC identity
 * every table keys on; what it stops being is a bearer secret. Authority now
 * comes from a server-minted session token, held per device, stored only as
 * a SHA-256 hash — the same doctrine the feed token proved out
 * (lib/feedToken.ts): a database dump must not contain working credentials.
 *
 * THE ROLLOUT RULE, because six real people are mid-beta on production:
 * an account with no session yet ("unclaimed", claimedAt null) behaves
 * exactly as before — the bare id works. The client claims on its next boot,
 * and from that instant the account requires the token. Nobody is ever
 * locked out by the deploy itself; a second device that arrives after the
 * first claimed restores silently with the recovery code it already holds
 * in localStorage.
 *
 * That rule shipped with no expiry, which made it a hole rather than a
 * rollout: claiming happens on the account's OWN next boot, so an account
 * nobody opens stays readable and writable by anyone holding its id, forever.
 * Measured on production 2026-08-19, three days in: 1 of 20 profiles claimed,
 * and zero of the other 19 had ever had a row in account_sessions. The gate
 * was protecting one person. Five of the nineteen carry hand-typed ids —
 * orrery-demo, felt-test, cadence-test, obs_ns3, obs_push_route_verify — which
 * are not guessed so much as typed, and orrery-demo holds real data across
 * fourteen tables.
 *
 * So the window now ENDS: see lib/tofuWindow.ts.
 *
 * Email login is the deliberate NON-choice: magic links need Resend, and
 * RESEND_API_KEY is not on Railway. The recovery code is already the
 * cross-device secret this beta runs on; sessions give it teeth.
 */
import { db, testerProfiles, accountSessions } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { mintSessionToken, hashSessionToken, sessionTokenMatches } from "./sessionToken.js";
import { tofuWindowOpen } from "./tofuWindow.js";

export { mintSessionToken, hashSessionToken, sessionTokenMatches };
export { tofuDeadline, tofuWindowOpen } from "./tofuWindow.js";

/**
 * The verification cache. Every /api request with an identity costs a
 * verification, and two indexed lookups per request is real load on the hot
 * path — but the ephemeris taught this codebase the cache rule the hard way:
 * THE KEY MUST FULLY DETERMINE THE VALUE. The key here is the (testerId,
 * token-hash) pair — everything the verdict depends on — and every write that
 * could change a verdict (claim, restore, revoke, delete) clears the whole
 * cache rather than reasoning about which entries survive. Sixty seconds
 * bounds the staleness of a revocation that raced a cached allow.
 */
const CACHE_TTL_MS = 60_000;
const verdictCache = new Map<string, { at: number; allowed: boolean }>();

export function clearSessionCache(): void {
  verdictCache.clear();
}

export type SessionVerdict =
  | { state: "unclaimed" }                    // pre-accounts account, window still open
  | { state: "valid"; sessionId: number }
  | { state: "invalid"; reason: "no-session" | "window-closed" }
  | { state: "unknown-account" };             // no profile row at all (pre-first-sync)

/**
 * The whole authorization question, answered in one place.
 *
 * `unknown-account` passes through like `unclaimed` on purpose: a brand-new
 * signup makes several requests before its first /account/sync lands, and a
 * 401 there would break onboarding. An account that has never synced has
 * nothing on the server worth protecting yet.
 */
export async function verifySession(testerId: string, token: string | null): Promise<SessionVerdict> {
  const cacheKey = `${testerId}|${token ? hashSessionToken(token) : "-"}`;
  const hit = verdictCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.allowed ? { state: "valid", sessionId: -1 } : { state: "invalid", reason: "no-session" };
  }

  const profile = (await db.select({ claimedAt: testerProfiles.claimedAt })
    .from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
  if (!profile) return { state: "unknown-account" };
  // The unclaimed verdict is never cached — it is the one answer that changes
  // with the wall clock rather than with a row, so it must be recomputed. The
  // cache below only ever holds claimed-account verdicts, which is what lets
  // the deadline take effect at the instant it passes instead of a minute later.
  if (!profile.claimedAt) {
    return tofuWindowOpen() ? { state: "unclaimed" } : { state: "invalid", reason: "window-closed" };
  }

  if (!token) return { state: "invalid", reason: "no-session" };
  const row = (await db.select().from(accountSessions)
    .where(eq(accountSessions.tokenHash, hashSessionToken(token))).limit(1))[0];
  const ok = !!row && row.testerId === testerId && sessionTokenMatches(token, row.tokenHash);

  if (verdictCache.size > 5000) verdictCache.clear();
  verdictCache.set(cacheKey, { at: Date.now(), allowed: ok });

  if (!ok) return { state: "invalid", reason: "no-session" };
  // Liveness bookkeeping, throttled by the cache above (at most once per TTL
  // per session) and fire-and-forget — a slow write must not slow the request.
  void db.update(accountSessions).set({ lastSeenAt: new Date() })
    .where(eq(accountSessions.id, row.id)).catch(() => { /* bookkeeping only */ });
  return { state: "valid", sessionId: row.id };
}

/** Mint and persist a session for an account. Returns the ONE sight of the token. */
export async function mintSessionFor(testerId: string, origin: "claim" | "signup" | "recovery"): Promise<string> {
  const token = mintSessionToken();
  await db.insert(accountSessions).values({ testerId, tokenHash: hashSessionToken(token), origin });
  await db.update(testerProfiles).set({ claimedAt: new Date() })
    .where(and(eq(testerProfiles.testerId, testerId)));
  clearSessionCache();
  return token;
}

/**
 * Trust-on-first-use claim for accounts that predate sessions.
 *
 * Exactly once, and only while the window is open (lib/tofuWindow.ts): the
 * first claimer owns the account. Anyone else — including the owner's own
 * second device, and everyone at all once the deadline passes — proves
 * themselves with the recovery code instead, which every previously-synced
 * device already holds.
 */
export async function claimAccount(testerId: string): Promise<
  { ok: true; token: string } | { ok: false; reason: "no-profile" | "already-claimed" | "window-closed" }
> {
  const profile = (await db.select({ claimedAt: testerProfiles.claimedAt })
    .from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
  if (!profile) return { ok: false, reason: "no-profile" };
  if (profile.claimedAt) return { ok: false, reason: "already-claimed" };
  // After the deadline a bare id buys nothing here either. Checked AFTER
  // already-claimed so the accurate reason survives: a second device asking
  // late is still a second device, and both answers send it to the same place.
  if (!tofuWindowOpen()) return { ok: false, reason: "window-closed" };
  const token = await mintSessionFor(testerId, "claim");
  return { ok: true, token };
}
