import { describe, it, expect } from "vitest";
import { weaveDay, type WeaveItem } from "../artifacts/api-server/src/lib/dayWeaver.js";

// `date`/`at()` below use LOCAL Date constructors, so the viewer is whatever
// zone the test PROCESS runs in — and `weaveDay` defaulted `tzOffsetMin` to 0
// (UTC) when this fixture omitted it, which is only correct when the process
// itself happens to be UTC. CI also runs this suite under America/Chicago and
// Asia/Kolkata (.github/workflows/ci.yml); in Kolkata the mismatch is 5.5
// hours, and a test comparing an end-of-day cutoff crossed the boundary. Same
// fix as dayTimeline.test.ts/longSession.test.ts: say the viewer's zone out
// loud rather than let it default to an assumption only true on some machines.
const TZ = new Date(2026, 7, 5).getTimezoneOffset();
const AUSTIN = { lat: 30.27, lon: -97.74, tzOffsetMin: TZ };
const date = new Date(2026, 7, 5, 12, 0);
const at = (h: number, m = 0) => new Date(2026, 7, 5, h, m);

const items: WeaveItem[] = [
  { id: "1", title: "Deep work: rewrite the onboarding sequence", kind: "task", dueDate: "2026-08-05", estMinutes: 240 },
  { id: "2", title: "Send the contract", kind: "task", dueDate: "2026-08-02" },
  { id: "3", title: "Meditate", kind: "habit", estMinutes: 20 },
  { id: "4", title: "Reply to Dana", kind: "task" },
];

describe("day weaver", () => {
  it("returns the day in time order, not priority order", () => {
    const w = weaveDay({ items, date, ...AUSTIN });
    const times = w.placed.map(p => p.startAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(w.placed.length).toBeGreaterThan(0);
  });

  it("never overlaps two placements", () => {
    const w = weaveDay({ items, date, ...AUSTIN });
    for (let i = 1; i < w.placed.length; i++) {
      expect(w.placed[i].startAt.getTime()).toBeGreaterThanOrEqual(w.placed[i - 1].endAt.getTime());
    }
  });

  it("never places over a commitment", () => {
    const commitments = [{ startAt: at(13), endAt: at(14), title: "Standup" }];
    const w = weaveDay({ items, date, ...AUSTIN, commitments });
    for (const p of w.placed) {
      expect(p.startAt >= at(14) || p.endAt <= at(13)).toBe(true);
    }
  });

  // Inventing a duration for something we could neither estimate nor classify
  // gave "Renew the domain" — a two-minute chore — a 45-minute block. That is
  // the slot-stuffing this design refuses.
  it("refuses to invent a duration, and says why", () => {
    const w = weaveDay({ items: [{ id: "x", title: "Renew the domain", kind: "task" }], date, ...AUSTIN });
    expect(w.placed).toEqual([]);
    expect(w.unplaced[0].reason).toMatch(/add a rough duration/);
  });

  it("marks a duration it assumed", () => {
    const w = weaveDay({ items, date, ...AUSTIN });
    const contract = w.placed.find(p => p.item.id === "2");
    expect(contract?.assumedDuration).toBe(true);     // no estMinutes given
    const deep = w.placed.find(p => p.item.id === "1");
    expect(deep?.assumedDuration).toBe(false);        // 240 was specified
  });

  // Gaps are output. A day with a few placements and a lot of white space is a
  // real plan, and openTime is how the UI can render that as deliberate.
  it("reports open time rather than filling the day", () => {
    const w = weaveDay({ items, date, ...AUSTIN });
    expect(w.openTime.length).toBeGreaterThan(0);
    const booked = w.placed.reduce((n, p) => n + p.minutes, 0);
    const open = w.openTime.reduce((n, o) => n + o.minutes, 0);
    expect(open).toBeGreaterThan(0);
    // The ceiling is ergonomic, not astrological: it must actually bind.
    expect(booked / (booked + open)).toBeLessThan(0.75);
  });

  it("leaves a wind-down rather than working to the minute sleep starts", () => {
    const w = weaveDay({ items, date, ...AUSTIN, sleepHour: 23 });
    for (const p of w.placed) expect(p.endAt.getHours()).toBeLessThan(23);
    for (const o of w.openTime) expect(o.endAt.getTime()).toBeLessThanOrEqual(at(22, 30).getTime());
  });

  it("says what it could not place and why, instead of dropping it", () => {
    const busy = [{ startAt: at(8), endAt: at(21), title: "All day" }];
    const w = weaveDay({ items, date, ...AUSTIN, commitments: busy });
    const accounted = w.placed.length + w.unplaced.length;
    expect(accounted).toBe(items.length);
    for (const u of w.unplaced) expect(u.reason.length).toBeGreaterThan(15);
  });

  it("places nothing when the person holds nothing", () => {
    const w = weaveDay({ items: [], date, ...AUSTIN });
    expect(w.placed).toEqual([]);
    expect(w.unplaced).toEqual([]);
    expect(w.openTime.length).toBeGreaterThan(0);   // the day is still a day
  });
});

// The plain weave (home-base build 2026-08-16): `consultSky: false` is the
// astro-quiet lens's path through the SAME weaver — a second weaver would
// drift, which is the WeekStrip/AlreadyWoven bug shape.
describe("the plain weave", () => {
  it("never consults an election — every basis is practical", () => {
    const w = weaveDay({ items, date, ...AUSTIN, consultSky: false });
    expect(w.placed.length).toBeGreaterThan(0);
    // "rest" is the other practical basis (2026-08-21): a recovery item goes
    // into the latest free stretch. Neither consults the sky; "elected" and
    // "usual" are the ones that must never appear at the quiet lens.
    for (const p of w.placed) expect(["first-fit", "rest"]).toContain(p.basis);
  });

  it("still respects commitments and reports refusals", () => {
    const busy = [{ startAt: at(8), endAt: at(21), title: "All day" }];
    const w = weaveDay({ items, date, ...AUSTIN, commitments: busy, consultSky: false });
    expect(w.placed.length + w.unplaced.length).toBe(items.length);
    for (const u of w.unplaced) expect(u.reason.length).toBeGreaterThan(15);
  });

  it("hands high-energy work the earlier stretch, deadlines equal", () => {
    const pair: WeaveItem[] = [
      { id: "lo", title: "Sort receipts", kind: "task", estMinutes: 60, energy: "low" },
      { id: "hi", title: "Rewrite the onboarding sequence", kind: "task", estMinutes: 60, energy: "high" },
    ];
    const w = weaveDay({ items: pair, date, ...AUSTIN, consultSky: false });
    const hi = w.placed.find(p => p.item.id === "hi");
    const lo = w.placed.find(p => p.item.id === "lo");
    expect(hi && lo).toBeTruthy();
    expect(hi!.startAt.getTime()).toBeLessThan(lo!.startAt.getTime());
  });

  it("keeps deadline pressure above energy", () => {
    const pair: WeaveItem[] = [
      { id: "due", title: "Send the contract", kind: "task", estMinutes: 30, energy: "low", dueDate: "2026-08-05" },
      { id: "hi", title: "Rewrite the onboarding sequence", kind: "task", estMinutes: 60, energy: "high" },
    ];
    const w = weaveDay({ items: pair, date, ...AUSTIN, consultSky: false });
    const due = w.placed.find(p => p.item.id === "due");
    const hi = w.placed.find(p => p.item.id === "hi");
    expect(due && hi).toBeTruthy();
    expect(due!.startAt.getTime()).toBeLessThan(hi!.startAt.getTime());
  });
});
