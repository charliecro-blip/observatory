/**
 * The end of the trust-on-first-use window.
 *
 * The rest of the session model needs a database to say anything, so it lives
 * in accountAuth.integration.test.ts and skips without TEST_DATABASE_URL. The
 * deadline itself is pure arithmetic on a clock, and it is the single most
 * consequential line in the model — the difference between a rollout that ends
 * and one that quietly never does — so it is tested where CI will actually run
 * it.
 *
 * Every instant here is written in UTC and passed in explicitly. The suite runs
 * three times under three zones; a deadline that means a different moment in
 * Kolkata than in Chicago is a bug, not a test detail.
 */
import { describe, it, expect, afterEach } from "vitest";
import { tofuDeadline, tofuWindowOpen } from "../artifacts/api-server/src/lib/tofuWindow.js";

const DEFAULT_DEADLINE = Date.parse("2026-08-23T00:00:00Z");

describe("the TOFU deadline", () => {
  afterEach(() => {
    delete process.env["COMPASS_TOFU_DEADLINE"];
  });

  it("is one absolute instant, not a local date", () => {
    expect(tofuDeadline()).toBe(DEFAULT_DEADLINE);
    // The same wall-clock hour in a different zone is a different instant, and
    // only one of them may sit inside the window.
    expect(tofuWindowOpen(Date.parse("2026-08-22T23:59:59Z"))).toBe(true);
    expect(tofuWindowOpen(Date.parse("2026-08-23T00:00:00Z"))).toBe(false);
    expect(tofuWindowOpen(Date.parse("2026-08-23T00:00:01Z"))).toBe(false);
  });

  it("is open across the rollout it exists to end", () => {
    // 2026-08-16 shipped sessions; the window has to cover the days between.
    expect(tofuWindowOpen(Date.parse("2026-08-16T00:00:00Z"))).toBe(true);
    expect(tofuWindowOpen(Date.parse("2026-08-19T18:00:00Z"))).toBe(true);
    expect(tofuWindowOpen(Date.parse("2026-09-01T00:00:00Z"))).toBe(false);
  });

  it("reads the override at call time, so Railway can shut it without a deploy", () => {
    process.env["COMPASS_TOFU_DEADLINE"] = "2026-08-20T12:00:00Z";
    expect(tofuDeadline()).toBe(Date.parse("2026-08-20T12:00:00Z"));
    expect(tofuWindowOpen(Date.parse("2026-08-20T11:59:00Z"))).toBe(true);
    expect(tofuWindowOpen(Date.parse("2026-08-20T12:00:01Z"))).toBe(false);
  });

  it("shuts on an unparseable override instead of falling back to the default", () => {
    // A typo in a security control must not silently restore the thing the
    // control removes. Closed is the safe direction: the way back in is the
    // recovery code, which is a working path, not a lockout.
    process.env["COMPASS_TOFU_DEADLINE"] = "next tuesday";
    expect(tofuWindowOpen(Date.parse("2026-08-17T00:00:00Z"))).toBe(false);
    expect(tofuWindowOpen(0)).toBe(false);
  });

  it("ignores an empty or whitespace override rather than reading it as a typo", () => {
    // An unset Railway variable arrives as "", and treating that as garbage
    // would shut the window on every deploy that merely forgot to set it.
    process.env["COMPASS_TOFU_DEADLINE"] = "   ";
    expect(tofuDeadline()).toBe(DEFAULT_DEADLINE);
  });
});
