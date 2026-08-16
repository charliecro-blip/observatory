/**
 * Session-token primitives — pure, so they can be unit-tested without a
 * database in scope (routes/habits taught this: a lib behind a db import is
 * a lib without tests). Same doctrine as the feed token: mint from crypto
 * randomness, store only the SHA-256, compare in constant time.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** 32 bytes, URL-safe, visibly a session credential. Shown once. */
export function mintSessionToken(): string {
  return `sess_${randomBytes(32).toString("base64url")}`;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so a hash can't be probed a byte at a time. */
export function sessionTokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashSessionToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
