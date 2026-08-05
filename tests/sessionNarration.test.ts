import { describe, it, expect } from "vitest";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession.js";
import { narrateSession } from "../artifacts/api-server/src/lib/sessionNarration.js";

const AUSTIN = { lat: 30.27, lon: -97.74 };
const TROMSO = { lat: 69.65, lon: 18.96 };
const aug = (d: number) => new Date(2026, 7, d, 12, 0);

const firstOption = (key: string, minutes: number, date: Date, place = AUSTIN) =>
  findLongSessions({ activityKey: key, minutes, date, ...place })?.options[0]?.candidate ?? null;

describe("session narration", () => {
  // The failure the clock span replaced: the arc line began "Venus → Mercury"
  // while the prose said Mercury ruled "at the start". Mercury did fall inside
  // the opening third, so the placement word was technically right and plainly
  // contradicted what the reader could see one line above.
  it("never claims a ruler leads when the arc shows another first", () => {
    for (let d = 3; d <= 20; d++) {
      const c = firstOption("deep-work", 240, aug(d));
      if (!c?.arc.length) continue;
      const n = narrateSession(c);
      const first = c.arc[0].ruler;
      const claimsStart = /rules\s+(\w+)\s+at the start/.exec(n.map);
      if (claimsStart) expect(claimsStart[1]).toBe(first);
    }
  });

  // The product rule this module exists for. A per-hour instruction list would
  // push someone to switch cognitive mode whenever the ruler changes.
  it("does not issue a per-hour instruction list", () => {
    const c = firstOption("deep-work", 240, aug(5))!;
    const n = narrateSession(c);
    // One paragraph, and it says so explicitly.
    expect(n.map).toMatch(/do not need to change tasks/i);
    // No "Ruler hour: verb." cells.
    expect(n.map).not.toMatch(/\b(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn) hour:/);
  });

  // This assertion started as `expect(typeof sawNeutral).toBe("boolean")` —
  // the exact vacuous pattern an audit caught elsewhere in this codebase, and
  // it passed while proving nothing. Measuring showed why it never fired on the
  // path it scanned: `options[0]` is ranked BY preferred-hour coverage, so the
  // top option almost always has one. The neutral branch lives on the earliest
  // workable option instead. Measured across 28 days x 4 activities: 8.8% of
  // 4-hour options and 41% of 1-hour ones have no preferred ruler.
  it("says plainly when no hour is one the activity wants", () => {
    let neutral = 0, withArc = 0;
    for (let d = 1; d <= 28; d++) {
      for (const key of ["deep-work", "train-hard", "first-draft"]) {
        for (const mins of [60, 240]) {
          const r = findLongSessions({ activityKey: key, minutes: mins, date: aug(d), ...AUSTIN });
          for (const o of r?.options ?? []) {
            if (!o.candidate.arc.length) continue;
            withArc++;
            if (o.candidate.arc.some(a => a.preferred)) continue;
            neutral++;
            expect(narrateSession(o.candidate).map).toMatch(/particularly wants/);
          }
        }
      }
    }
    // Without this the loop above could pass by never entering — the defect it
    // replaced. The measured rate is well above this floor.
    expect(withArc).toBeGreaterThan(100);
    expect(neutral).toBeGreaterThan(20);
  });

  // An exactitude sitting on the block's own edge is not an anchor: building a
  // session around it puts the moment you care about at the instant you stop.
  it("does not report an anchor sitting on the boundary", () => {
    for (let d = 1; d <= 28; d++) {
      const c = firstOption("deep-work", 240, aug(d));
      if (!c?.anchor) continue;
      const n = narrateSession(c);
      const onEdge =
        Math.abs(c.anchor.at.getTime() - c.startAt.getTime()) < 10 * 60000 ||
        Math.abs(c.endAt.getTime() - c.anchor.at.getTime()) < 10 * 60000;
      if (onEdge) expect(n.notes.join(" ")).not.toMatch(/perfects at/);
    }
  });

  it("withholds the arc under polar night but still describes the block", () => {
    const c = findLongSessions({ activityKey: "deep-work", minutes: 240, date: new Date(2026, 11, 21, 12, 0), ...TROMSO })!.options[0].candidate;
    const n = narrateSession(c);
    expect(n.arcLine).toBeNull();
    expect(n.map).toMatch(/hours, unbroken/);
    // No invented sequence, and no claim about rulers it cannot know.
    expect(n.map).not.toMatch(/rules/);
  });

  it("suggests a break only near the midpoint, never at every boundary", () => {
    for (let d = 1; d <= 20; d++) {
      const c = firstOption("deep-work", 240, aug(d));
      if (!c) continue;
      const n = narrateSession(c);
      const breaks = n.notes.filter(x => /natural place to stop/.test(x));
      expect(breaks.length).toBeLessThanOrEqual(1);
      if (n.suggestedBreakAt) {
        const mid = c.startAt.getTime() + (c.durationMinutes / 2) * 60000;
        expect(Math.abs(n.suggestedBreakAt.getTime() - mid) / 60000).toBeLessThanOrEqual(20);
      }
    }
  });

  it("reports a void inside the block without ending it", () => {
    for (let d = 1; d <= 28; d++) {
      const c = firstOption("deep-work", 240, aug(d));
      if (!c) continue;
      if (!c.transitions.some(t => t.kind === "void-begins")) continue;
      const n = narrateSession(c);
      expect(n.notes.join(" ")).toMatch(/goes void/);
      expect(n.notes.join(" ")).toMatch(/block still runs/);
      expect(c.durationMinutes).toBe(240);   // not truncated by the void
      return;
    }
  });
});

describe("narration is written in the viewer's timezone", () => {
  // toLocaleTimeString without an explicit zone formats in the PROCESS's zone,
  // which is UTC on Railway. A block running 2:15PM in Austin was narrated as
  // 7:15PM, so the prose and the ISO instants in the same response disagreed by
  // five hours — and only the prose is what anyone reads.
  it("shifts the clock by the offset it is given", () => {
    const c = firstOption("deep-work", 240, aug(5))!;
    const utc = narrateSession(c, 0);
    const austin = narrateSession(c, 300);   // CDT: UTC-5, getTimezoneOffset()=300
    expect(utc.map).not.toBe(austin.map);

    const hourOf = (s: string) => {
      const m = /(\d{1,2}):(\d{2})(AM|PM)/.exec(s)!;
      let h = Number(m[1]) % 12;
      if (m[3] === "PM") h += 12;
      return h;
    };
    // Exactly five hours earlier, wrapping the clock.
    expect((hourOf(utc.map) - hourOf(austin.map) + 24) % 24).toBe(5);
  });

  it("agrees with the ISO instant it describes", () => {
    const c = firstOption("deep-work", 240, aug(5))!;
    const offset = 300;
    const n = narrateSession(c, offset);
    const shifted = new Date(c.startAt.getTime() - offset * 60000);
    const expected = shifted.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).replace(/\s/g, "");
    expect(n.map.startsWith(expected)).toBe(true);
  });
});
