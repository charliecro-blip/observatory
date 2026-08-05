import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Calendar must not compute planetary hours itself.
 *
 * This file used to mirror Calendar's client-side sunrise/sunset and assert it
 * matched the server's, and its own docblock said why that was a stopgap:
 *
 *   "These tests hold the two implementations together. The real fix is one
 *    canonical timing service; until that lands, this makes a divergence fail
 *    loudly instead of showing two different skies on two tabs."
 *
 * That landed. Calendar now reads /api/tides/planetary-hours, and the ~90 lines
 * of client astronomy are gone. So the guard changes shape: instead of holding
 * two implementations in agreement, it asserts there is only one.
 *
 * Worth keeping rather than deleting, because the pressure that created the
 * duplicate is still there — the month grid wants hours synchronously, and
 * reaching for a local Chaldean loop is the obvious shortcut. The divergence it
 * caused was real: the client returned null above the polar circles while the
 * server fabricated a symmetric twelve-hour day.
 */

const CALENDAR = readFileSync(
  join(process.cwd(), "artifacts/tides/src/pages/Calendar.tsx"), "utf8");

// Comments describe the removal, so a naive grep would match its own
// explanation. Strip them first — a test that matches the prose about a bug
// rather than the bug is a defect this codebase has hit before.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CODE = stripComments(CALENDAR);

describe("one canonical source for planetary hours", () => {
  it("Calendar consumes the server endpoint", () => {
    expect(CODE).toMatch(/api\/tides\/planetary-hours/);
  });

  it("Calendar carries no Chaldean sequence of its own", () => {
    expect(CODE).not.toMatch(/\bCHALDEAN\b/);
    // The signature of a local hour loop: the seven-planet ring, modulo 7.
    expect(CODE).not.toMatch(/%\s*7\s*\]/);
  });

  it("Calendar carries no solar geometry of its own", () => {
    for (const marker of ["approxSunriseSunset", "computeAllPlanetaryHours", "cosH", "sinDec"]) {
      expect(CODE, `${marker} is back in Calendar`).not.toMatch(new RegExp(`\\b${marker}\\b`));
    }
  });

  // The polar case is the concrete divergence that existed. The endpoint
  // returns null there and the client must be able to represent that, rather
  // than coercing it to an empty list and rendering a day with no hours as if
  // it were a day whose hours had not loaded.
  it("can represent hours being genuinely unavailable", () => {
    expect(CODE).toMatch(/PlanetHour\[\]\s*\|\s*null/);
  });
});
