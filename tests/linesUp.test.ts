import { describe, it, expect } from "vitest";
import { linesUp, type HeldItem } from "../artifacts/api-server/src/lib/linesUp.js";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences.js";

// AT pins the moment, because the sky does not repeat.
//
// Without it these tests answered for whatever day they happened to run on,
// and three went red on 2026-08-09 with the engine working exactly as
// designed: that day's only testimony for these activities was planetary
// hours, and the planetary-time floor correctly refused to headline them.
// The anchor is noon in Austin on a day measured to carry real testimony, so
// the assertions below test the engine rather than the calendar.
const AT = new Date(Date.UTC(2026, 7, 8, 17)); // noon in Austin (UTC-5)
const base = { lat: 30.27, lon: -97.74, tzOffsetMin: 300, natal: null, timeKnown: true, locationKnown: true, now: AT };
const held = (title: string, extra: Partial<HeldItem> = {}): HeldItem =>
  ({ id: title.slice(0, 8), title, kind: "task", ...extra });

describe("what lines up", () => {
  it("says thin-inventory rather than showing an empty module", () => {
    const r = linesUp({ ...base, held: [] });
    expect(r.quiet).toBe("thin-inventory");
    expect(r.results).toEqual([]);
  });

  // The measured case that broke the first rule: "Finish & ship" scored 2.25,
  // the right answer, with "Meditate / pray" second at 1.38 on incidental
  // overlap. A pure margin rule turned a correct match into the question
  // "Finish & ship, or meditate?" — worse than either alternative.
  it("does not treat an implausible runner-up as a rival", () => {
    const r = linesUp({ ...base, held: [held("Finish the Q3 positioning memo and circulate it to the three people who asked")] });
    const asked = r.clarify.map(c => c.candidates.map(x => x.label).join("/"));
    expect(asked.some(a => /Meditate/i.test(a))).toBe(false);
  });

  // Nothing in the palette should be silently timed as something else.
  it("stays silent on an item with no credible match", () => {
    const r = linesUp({ ...base, held: [held("Renew the domain")] });
    expect(r.results).toEqual([]);
    expect(r.clarify).toEqual([]);
  });

  // A pre-assigned key is the person's own classification (Guiding Stars carry
  // one from planet-diagnosis). Re-matching the title would let the keyword
  // matcher overrule them.
  it("uses an assigned activityKey instead of re-matching the title", () => {
    const r = linesUp({ ...base, held: [held("something the matcher would never recognise", { activityKey: "deep-work", kind: "star-step" })] });
    const seen = [...r.results, ...([] as any)].map(x => x.activityKey);
    // Either it produced a result for deep-work, or the day had no window for
    // it — but it must never have been sent to the matcher and lost.
    expect(r.clarify).toEqual([]);
    if (seen.length) expect(seen).toContain("deep-work");
  });

  it("ignores a stale activityKey rather than dropping the item", () => {
    const r = linesUp({ ...base, held: [held("Deep work: rewrite the onboarding sequence", { activityKey: "no-such-activity" })] });
    // Falls through to matching; must not throw and must not vanish silently.
    expect(r.results.every(x => x.activityKey !== "no-such-activity")).toBe(true);
  });

  it("never returns more than three results", () => {
    const many = Array.from({ length: 10 }, (_, i) => held(`Deep work sprint number ${i}`));
    expect(linesUp({ ...base, held: many }).results.length).toBeLessThanOrEqual(3);
  });

  // This started as a 5s test timeout and was a real performance finding: ten
  // held items meant ten full ephemeris runs at ~600ms each, so anyone with ten
  // open tasks waited six seconds on every Home load. Elections are memoised
  // per ACTIVITY, since the computation does not depend on which task asked.
  //
  // Asserted by COUNTING, not by timing. A millisecond budget measured the
  // machine and failed under the parallel suite; so did a ratio, because the
  // one-item baseline is a few milliseconds and jitter swamps it. The result
  // now reports how many elections it ran, which is exact and load-independent.
  it("prices each activity once, not each item", () => {
    const many = Array.from({ length: 12 }, (_, i) => held(`Deep work sprint number ${i}`));
    const r = linesUp({ ...base, held: many });
    expect(r.electionsComputed).toBe(1);           // twelve items, one activity
  });

  it("prices distinct activities separately", () => {
    const mixed = [held("Deep work sprint"), held("Long run"), held("Sign a contract"), held("Deep work sprint again")];
    const r = linesUp({ ...base, held: mixed });
    expect(r.electionsComputed).toBeGreaterThan(1);
    expect(r.electionsComputed).toBeLessThanOrEqual(3);
  });
});

/**
 * A shared pool of TODAY'S actual results, for the property tests below.
 *
 * Three tests used to run linesUp over three or four hand-picked titles and
 * assert results existed. That is not an invariant — whether "Deep work
 * sprint" gets a window is a fact about today's sky, and on 2026-08-09 the
 * afternoon went quiet for all four titles at once and turned the suite red
 * with no defect anywhere. (The full-palette sweep at the bottom of this file
 * predicted exactly this failure mode for hand-picked keys.)
 *
 * So the properties now draw from a pool built across a DIVERSE slice of the
 * palette, computed once — and when even that pool is empty, each test falls
 * back to asserting the accounting invariant (nothing vanished) rather than
 * failing, because "the sky is quiet about all of these right now" is a
 * legitimate answer, not a regression. The properties go untested in that
 * moment; the alternative is a test that fails at certain times of day.
 */
const POOL_KEYS = [
  "deep-work", "sign-contract", "finish-polish", "long-run", "rest",
  "write-publish", "ask-favor", "declutter", "learn-study", "negotiate",
];
let poolRuns: { key: string; r: ReturnType<typeof linesUp> }[] | null = null;
function pool() {
  poolRuns ??= POOL_KEYS.map(key => ({
    key, r: linesUp({ ...base, held: [held(`pool item for ${key}`, { activityKey: key })] }),
  }));
  return poolRuns;
}
function poolResults() { return pool().flatMap(p => p.r.results); }
/** Emptiness is only acceptable when every pool item is ACCOUNTED for. */
function expectPoolAccounted() {
  for (const { key, r } of pool()) {
    const n = r.results.length + r.heldBack.length + r.clarify.length + r.alreadyScheduled.length;
    expect(n, `${key}: the item must land somewhere, quiet sky or not`).toBeGreaterThanOrEqual(1);
  }
}

describe("all-day testimony", () => {
  // The engine returns windows with allDay:true — the Moon's sign, say — whose
  // clock range is just the waking day. Rendering "7 AM–11 PM" as a
  // recommendation dressed a standing condition up as an appointment, and this
  // module exists to answer WHEN.
  it("prefers a bounded window over an all-day one at equal strength", () => {
    const rows = poolResults();
    if (!rows.length) { expectPoolAccounted(); return; }
    const bounded = rows.filter(x => !x.allDay).length;
    expect(bounded).toBeGreaterThanOrEqual(rows.length - bounded);
  }, 120_000);

  // `expect(typeof x.allDay).toBe("boolean")` was here, which asserts nothing —
  // the fourth instance of that pattern in this session. And the loop ran six
  // IDENTICAL iterations, so it was six full election computations proving one
  // thing once and timing out. Both replaced with the actual claim: whatever a
  // row says, the flag and the clock range agree about it.
  it("never prints the waking day as if it were an hour", () => {
    const r = linesUp({ ...base, held: [held("Deep work sprint"), held("Long run"), held("Sign a contract")] });
    for (const x of r.results) {
      const spansWholeDay = /^7 ?AM$/.test(x.startClock) && /^11 ?PM$/.test(x.endClock);
      // A whole-day span is only allowed to appear when the row admits it is
      // an all-day condition, which is what lets the UI say "all day" instead.
      if (spansWholeDay) expect(x.allDay).toBe(true);
    }
  });
});

describe("the moment, not just the day", () => {
  // The owner's note: the page should answer for the exact moment, not only
  // for the quality of the day. A window that closed at noon is not the answer
  // to "what should I do now" at four o'clock, however strong it was — and it
  // was leading the page.
  it("never leads with a window that has already passed when one is still ahead", () => {
    for (const title of ["Deep work sprint", "Long run", "Sign a contract"]) {
      const r = linesUp({ ...base, held: [held(title)] });
      if (r.results.length < 2) continue;
      const states = r.results.map(x => x.state);
      // Ordered: open-now, then ahead, then passed. Never a passed one above
      // a live one.
      const rank: Record<string, number> = { "open-now": 0, ahead: 1, passed: 2 };
      for (let i = 1; i < states.length; i++) {
        expect(rank[states[i]]).toBeGreaterThanOrEqual(rank[states[i - 1]]);
      }
    }
  });

  it("labels every result with where it sits relative to now", () => {
    const rows = poolResults();
    if (!rows.length) { expectPoolAccounted(); return; }
    for (const x of rows) {
      expect(["open-now", "ahead", "passed"]).toContain(x.state);
      // The instants must actually agree with the label they carry.
      const startMs = Date.parse(x.startAt);
      const endMs = Date.parse(x.endAt);
      expect(Number.isNaN(startMs)).toBe(false);
      if (!x.allDay) {
        if (x.state === "ahead") expect(startMs).toBeGreaterThan(AT.getTime());
        if (x.state === "passed") expect(endMs).toBeLessThanOrEqual(AT.getTime());
      }
    }
  }, 120_000);
});

describe("already scheduled work is not a timing question", () => {
  // tasks.planning_window_id has existed and been backfilled for days, and
  // nothing read it — so Compass offered to find a time for work the person had
  // already committed to.
  it("does not time an item that already holds a block", () => {
    const r = linesUp({ ...base, held: [held("Deep work sprint", { scheduledFor: "412" })] });
    expect(r.results).toEqual([]);
    expect(r.alreadyScheduled.map(x => x.title)).toEqual(["Deep work sprint"]);
  });

  it("still times the same item when nothing is reserved", () => {
    const r = linesUp({ ...base, held: [held("Deep work sprint")] });
    expect(r.alreadyScheduled).toEqual([]);
  });
});

describe("evidence is kept apart, not joined", () => {
  // Each testimony is computed separately and was then joined into one string.
  // Three facts a reader can weigh is a different thing from one blur they can
  // only accept.
  it("returns one line per testimony", () => {
    const rows = poolResults();
    if (!rows.length) { expectPoolAccounted(); return; }
    for (const x of rows) {
      expect(Array.isArray(x.evidence)).toBe(true);
      // The joined string and the array must agree about content.
      if (x.why) expect(x.evidence.length).toBeGreaterThan(0);
      // `.text`, not the entry. This line used to read `expect(line)` when
      // evidence was `string[]`; once entries became `{family, text}` the
      // assertion silently stopped testing anything — `toContain` on an
      // object cannot find a substring, so it passed for the wrong reason and
      // the "no joined strings" guarantee quietly lapsed.
      for (const line of x.evidence) {
        expect(typeof line.text, "a testimony must carry text").toBe("string");
        expect(line.text).not.toContain(" · ");
      }
    }
  }, 120_000);
});

/**
 * The house rule the module is named for: gaps and refusals are OUTPUT.
 *
 * Four bare `continue`s used to drop a priced item on the floor — no window
 * today, the matter better deferred, an hour-only case — and the surface then
 * showed a task with no timing line, which is indistinguishable from a task
 * Compass never looked at.
 */
describe("a priced item is never dropped silently", () => {
  // Asserted as an INVARIANT rather than against a specific verdict, because
  // `linesUp` reads today's sky: whether a given activity is timed, deferred or
  // barren changes daily, so pinning one outcome would be a test that passes
  // until the Moon moves.
  //
  // The sweep is EVERY activity, not a hand-picked five. The first draft used
  // five and all five were timeable that day, so the test asserted an accounting
  // rule while never once reaching the branch it was written for. Across the
  // whole palette some activity is always short of a window, which is what makes
  // the coverage assertion below safe to demand.
  //
  // COST: ~35s, one election per activity, and the breadth is what buys the
  // coverage — batching into fewer `linesUp` calls saves nothing, since the
  // memo is per call and the same 62 computations still run. Kept in the deploy
  // gate because "never drop an item silently" is a product constraint rather
  // than a nicety. If the suite gets tight, this is the one to move to `tools/`
  // alongside the fire-rate sweep — but move it, do not narrow it, or it goes
  // back to passing without testing anything.
  it("accounts for every item that reached the pricing loop", () => {
    let heldBackSeen = 0;
    for (const a of ACTIVITIES) {
      const item = held(`held item for ${a.key}`, { activityKey: a.key });
      const r = linesUp({ ...base, held: [item] });
      const inResults = r.results.some(x => x.held.id === item.id);
      const inHeldBack = r.heldBack.some(x => x.item.id === item.id);
      const inScheduled = r.alreadyScheduled.some(x => x.id === item.id);
      expect(
        [inResults, inHeldBack, inScheduled].filter(Boolean).length,
        `${a.key}: an item with a real activityKey must land in exactly one bucket`,
      ).toBe(1);
      if (inHeldBack) {
        heldBackSeen++;
        const reason = r.heldBack.find(x => x.item.id === item.id)!.reason;
        expect(reason.trim(), `${a.key}: a refusal must carry its reason`).not.toBe("");
      }
    }
    // Without this the accounting rule could be satisfied entirely by the
    // results path, and the refusal path would go untested on any day the sky
    // happened to be generous.
    expect(heldBackSeen, "the refusal path must actually be exercised").toBeGreaterThan(0);
  }, 120_000);
});
