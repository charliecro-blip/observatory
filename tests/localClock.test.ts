import { describe, it, expect } from "vitest";
import { clockIn, dateIn, stampIn } from "../artifacts/api-server/src/lib/localClock.js";

// The instant: 2026-08-05 01:30 UTC. In Austin (CDT, UTC-5) that is
// 2026-08-04 at 8:30 PM — a different DAY, which is what made this dangerous
// in a prompt rather than merely untidy in a label.
const instant = new Date(Date.UTC(2026, 7, 5, 1, 30));
const AUSTIN = 300;   // getTimezoneOffset() west of Greenwich is positive
const TOKYO = -540;

describe("viewer-timezone formatting", () => {
  it("gives the viewer's wall clock, not the server's", () => {
    expect(clockIn(instant, 0)).toBe("1:30AM");
    expect(clockIn(instant, AUSTIN)).toBe("8:30PM");
    expect(clockIn(instant, TOKYO)).toBe("10:30AM");
  });

  // The failure that mattered: the advisor was told the date, and for an
  // evening user west of Greenwich the server's UTC date is already tomorrow.
  it("rolls the DATE back for an evening user west of Greenwich", () => {
    expect(dateIn(instant, 0)).toMatch(/August 5, 2026/);
    expect(dateIn(instant, AUSTIN)).toMatch(/August 4, 2026/);
    expect(dateIn(instant, TOKYO)).toMatch(/August 5, 2026/);
  });

  it("stamps a full moment in the viewer's frame", () => {
    expect(stampIn(instant, AUSTIN)).toMatch(/Aug 4/);
    expect(stampIn(instant, 0)).toMatch(/Aug 5/);
  });

  // Independence from the machine running the suite is the whole point: these
  // must hold on a developer laptop and on a UTC production box alike.
  it("does not depend on the process timezone", () => {
    // On a UTC box the naive form reads 1:30AM; on a CDT laptop it reads
    // 8:30PM. The helper answers the viewer's 8:30PM on both, which is the
    // entire point — this bug looks correct for the whole time you build it.
    expect(clockIn(instant, AUSTIN)).toBe("8:30PM");
  });

  // ICU emits U+202F (narrow no-break space) before the meridiem in current
  // Node, so a `/ /` strip leaves it behind and comparisons fail in a way that
  // reads as a whitespace typo rather than an encoding difference.
  it("leaves no whitespace of any kind before the meridiem", () => {
    for (const off of [0, AUSTIN, TOKYO, -330]) {
      expect(clockIn(instant, off)).not.toMatch(/[\s\u202f\u00a0]/);
    }
  });
});
