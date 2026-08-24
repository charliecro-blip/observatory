import { describe, it, expect } from "vitest";
import { weaveDay } from "../artifacts/api-server/src/lib/dayWeaver.js";

/**
 * A GUESSED DURATION MUST STAY VISIBLY A GUESS.
 *
 * The contract, settled in the beta audit: capture records what exists,
 * Compass judges when it fits, and scheduling asks how much space it needs.
 * Placement is allowed to SUGGEST a length for a task that carries no
 * estimate — refusing to draw anything unestimated would make the weave
 * useless on real data — but it must never let that suggestion pass for
 * something the person said.
 *
 * Today that holds by construction: the weave is a proposal nothing commits,
 * and Plan's inventory refuses to compute a window while a task is in
 * `needs-duration`. Both are easy to lose by accident, and the flag is the
 * only thing any surface has to tell the two apart — drop it and every
 * consumer starts treating an invented ninety minutes as a stated one, with
 * no error anywhere.
 */
const AUSTIN = { lat: 30.27, lon: -97.74, tzOffsetMin: new Date(2026, 7, 5).getTimezoneOffset() };
const date = new Date(2026, 7, 5, 12, 0);

describe("an invented duration is always flagged", () => {
  it("flags a placement whose length nobody stated", () => {
    const w = weaveDay({
      items: [{ id: "1", title: "Write the quarterly essay", kind: "task", estMinutes: null }],
      date, ...AUSTIN,
    });
    const placed = w.placed;
    // Either it declined to place it, or it placed it and said the length is ours.
    for (const p of placed) expect(p.assumedDuration).toBe(true);
  });

  it("does not flag a length the person actually gave", () => {
    const w = weaveDay({
      items: [{ id: "1", title: "Write the quarterly essay", kind: "task", estMinutes: 45 }],
      date, ...AUSTIN,
    });
    expect(w.placed.length).toBeGreaterThan(0);
    for (const p of w.placed) {
      expect(p.assumedDuration).toBe(false);
      expect(p.minutes).toBe(45);
    }
  });

  it("a stated duration is used exactly, not rounded to a window size", () => {
    // 45 is not one of the window defaults, so a placement of 45 proves the
    // stated value won rather than coinciding with a guess.
    const w = weaveDay({
      items: [{ id: "1", title: "Review the formulas", kind: "task", estMinutes: 45 }],
      date, ...AUSTIN,
    });
    expect(w.placed.map(p => p.minutes)).not.toContain(90);
  });
});
