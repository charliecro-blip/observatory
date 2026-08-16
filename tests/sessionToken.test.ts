import { describe, it, expect } from "vitest";
import { mintSessionToken, hashSessionToken, sessionTokenMatches } from "../artifacts/api-server/src/lib/sessionToken.js";

/**
 * The session credential's primitives (BACKLOG §2 — the bearer-token closure).
 *
 * Pure by construction: they live in their own module precisely so these tests
 * need no database, the same lesson habitTiming learned. The DB-coupled halves
 * (claim-once, verdicts) are covered in tests/accountAuth.integration.test.ts
 * against a real table.
 */

describe("session tokens", () => {
  it("mints unique, non-trivial, visibly-typed tokens", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = mintSessionToken();
      expect(t.startsWith("sess_")).toBe(true);
      // 32 bytes base64url = 43 chars + the prefix.
      expect(t.length).toBeGreaterThanOrEqual(48);
      seen.add(t);
    }
    expect(seen.size).toBe(200);
  });

  it("hashes stably and never stores the token shape", () => {
    const t = mintSessionToken();
    const h = hashSessionToken(t);
    expect(hashSessionToken(t)).toBe(h);     // deterministic
    expect(h).toMatch(/^[0-9a-f]{64}$/);     // SHA-256 hex — a hash, not a token
    expect(h.includes("sess_")).toBe(false);
  });

  it("matches only the token that made the hash", () => {
    const t = mintSessionToken();
    const h = hashSessionToken(t);
    expect(sessionTokenMatches(t, h)).toBe(true);
    expect(sessionTokenMatches(mintSessionToken(), h)).toBe(false);
    expect(sessionTokenMatches(t + "x", h)).toBe(false);
    expect(sessionTokenMatches("", h)).toBe(false);
  });
});
