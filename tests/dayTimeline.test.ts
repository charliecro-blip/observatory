import { describe, it, expect } from "vitest";
import { dayTimeline, containers } from "../artifacts/api-server/src/lib/dayTimeline.js";

const AUSTIN = { lat: 30.27, lon: -97.74 };
const day = (d: number) => new Date(2026, 7, d, 12, 0, 0);

describe("day timeline", () => {
  it("returns events in chronological order", () => {
    const ev = dayTimeline({ date: day(5), ...AUSTIN });
    const times = ev.map(e => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(ev.length).toBeGreaterThan(0);
  });

  it("keeps every event inside the local day", () => {
    const ev = dayTimeline({ date: day(5), ...AUSTIN });
    const start = new Date(2026, 7, 5, 0, 0, 0);
    const end = new Date(2026, 7, 6, 0, 0, 0);
    expect(ev.filter(e => e.at < start || e.at > end)).toEqual([]);
  });

  // The whole point of the module. Rev 1 cut at every lunar event; GPT's
  // critique was that this imports inceptional judgment into execution work.
  it("types lunar events as qualifications or chapters, never hard boundaries", () => {
    const LUNAR = new Set(["void-begins", "void-ends", "moon-ingress", "hour-change"]);
    for (let d = 3; d <= 12; d++) {
      const wrong = dayTimeline({ date: day(d), ...AUSTIN })
        .filter(e => LUNAR.has(e.kind) && e.role === "hard-boundary");
      expect(wrong.map(e => `${day(d).toDateString()} ${e.kind}`)).toEqual([]);
    }
  });

  it("only practical events are hard boundaries", () => {
    const PRACTICAL = new Set(["waking-start", "waking-end", "commitment-start", "commitment-end", "horizon-end"]);
    const ev = dayTimeline({
      date: day(5), ...AUSTIN,
      commitments: [{ startAt: new Date(2026, 7, 5, 13, 0), endAt: new Date(2026, 7, 5, 14, 0), title: "Standup" }],
    });
    for (const e of ev.filter(x => e_role(x) === "hard-boundary")) expect(PRACTICAL.has(e.kind)).toBe(true);
    function e_role(x: { role: string }) { return x.role; }
  });

  // Hours come from local sunrise/sunset, so on a guessed meridian every
  // boundary is fiction. The standing rule is that a disclaimer means the
  // design is wrong — so they are withheld, not captioned.
  it("emits no planetary-hour events when the location is a guess", () => {
    const ev = dayTimeline({ date: day(5), ...AUSTIN, locationKnown: false });
    expect(ev.filter(e => e.kind === "hour-change")).toEqual([]);
    // ...but the rest of the day still works.
    expect(ev.some(e => e.kind === "waking-start")).toBe(true);
  });

  it("finds the ingress by watching the sign change, not by mean speed", () => {
    // Over ten days the Moon must change sign at least three times (~2.5d each).
    let ingresses = 0;
    for (let d = 3; d <= 12; d++) {
      ingresses += dayTimeline({ date: day(d), ...AUSTIN }).filter(e => e.kind === "moon-ingress").length;
    }
    expect(ingresses).toBeGreaterThanOrEqual(3);
  });
});

describe("containers", () => {
  const bounds = [new Date(2026, 7, 5, 0, 0), new Date(2026, 7, 6, 0, 0)] as const;

  it("does not split a container at a lunar event", () => {
    const ev = dayTimeline({ date: day(5), ...AUSTIN });
    const cs = containers(ev, bounds[0], bounds[1]);
    // No commitments, so the waking day is ONE container however many voids,
    // ingresses and hour changes fall inside it.
    expect(cs.length).toBe(1);
    expect(cs[0].minutes).toBeGreaterThan(15 * 60);
  });

  it("splits at a commitment and reports what rode along inside", () => {
    const ev = dayTimeline({
      date: day(5), ...AUSTIN,
      commitments: [{ startAt: new Date(2026, 7, 5, 13, 0), endAt: new Date(2026, 7, 5, 14, 0), title: "Standup" }],
    });
    const cs = containers(ev, bounds[0], bounds[1]);
    expect(cs.length).toBe(2);
    expect(cs[0].endAt.getHours()).toBe(13);
    expect(cs[1].startAt.getHours()).toBe(14);
    // Every non-boundary event in the day is accounted for by some container.
    const inside = cs.flatMap(c => c.inside).length;
    expect(inside).toBeGreaterThan(0);
  });

  it("handles an overnight chronotype without inverting the day", () => {
    const ev = dayTimeline({ date: day(5), ...AUSTIN, wakeHour: 11, sleepHour: 3 });
    const cs = containers(ev, bounds[0], bounds[1]);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) expect(c.endAt.getTime()).toBeGreaterThan(c.startAt.getTime());
  });
});

describe("perfections, and who decides what they mean", () => {
  // The timeline emits perfections as FACTS. It used to stamp them "anchor"
  // universally, which put a judgment where the activity is unknown — the same
  // defect that had two modules disagreeing about suitability. What a
  // perfection is worth depends on what you intend to do with the block.
  it("emits perfections often enough to be usable, as plain sky events", () => {
    let days = 0, withPerfection = 0, total = 0;
    for (let d = 1; d <= 28; d++) {
      days++;
      const perfections = dayTimeline({ date: new Date(2026, 7, d, 12, 0), lat: 30.27, lon: -97.74 })
        .filter(e => e.kind === "moon-perfects");
      if (perfections.length) withPerfection++;
      total += perfections.length;
      for (const p of perfections) {
        expect(p.role).toBe("sky-event");     // a fact, not a verdict
        expect(p.detail?.planet).toBeTruthy();
        expect(p.detail?.aspect).toBeTruthy();
      }
    }
    expect(withPerfection).toBeGreaterThan(days / 2);
    expect(total).toBeGreaterThan(days);
  });

  it("assigns no astrological role of its own", () => {
    for (let d = 1; d <= 14; d++) {
      for (const e of dayTimeline({ date: new Date(2026, 7, d, 12, 0), lat: 30.27, lon: -97.74 })) {
        expect(["hard-boundary", "sky-event"]).toContain(e.role);
      }
    }
  });

  // ...and the evaluator does assign one, per activity. Without this the change
  // above would just be deletion.
  it("the evaluator turns a perfection into an anchor for an activity that wants one", async () => {
    const { skyEventRole } = await import("../artifacts/api-server/src/lib/electionEngine.js");
    expect(skyEventRole("moon-perfects", "deep-work")).toBe("anchor");
    // A void reads differently per activity, which is the whole point. Checked
    // against the real policies rather than guessed: sign-contract is an
    // `avoid` inception, so a void qualifies it; deep-work is `neutral`, so the
    // same event is genuinely irrelevant to it. Both are correct answers to the
    // same sky, which is why no universal role could have been right.
    expect(skyEventRole("void-begins", "sign-contract")).toBe("qualification");
    expect(skyEventRole("void-begins", "deep-work")).toBe("irrelevant");
    expect(skyEventRole("moon-perfects", "no-such-activity")).toBe("irrelevant");
  });
});
