/**
 * Calendar-feed tokens.
 *
 * Why this exists: a webcal:// URL is pasted into Google/Apple Calendar, which
 * store it and re-fetch it forever. The first version of the feed put the
 * `testerId` in that URL — and the tester id was the account credential, so a
 * feed link returned the personal logbook and, via /account/sync, the recovery
 * code. Full account takeover from a calendar subscription.
 *
 * A feed token is deliberately NOT an identity:
 *   · it is a distinct random secret, unrelated to the tester id or recovery code
 *   · it is accepted ONLY by the iCal export route
 *   · it is never read as `x-tester-id`, so it cannot authorise anything else
 *   · it is stored hashed, so a database dump doesn't hand out working feeds
 *   · it can be regenerated (invalidating the old link) or revoked outright
 *
 * The worst case for a leaked feed token is therefore: someone can see your
 * task titles and scheduled blocks. That is a real cost, stated plainly in the
 * UI, and bounded — which is the whole difference from what it replaced.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** URL-safe, 32 bytes of randomness — not guessable, not enumerable. */
export function mintFeedToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashFeedToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so the hash can't be probed a byte at a time. */
export function feedTokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashFeedToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
