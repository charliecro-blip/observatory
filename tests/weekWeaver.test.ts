import { describe, it, expect } from "vitest";
import { weaveWeek, type WeekItem } from "../artifacts/api-server/src/lib/weekWeaver.js";

const AUSTIN = { lat: 30.27, lon: -97.74 };
const startDate = new Date(2026, 7, 5, 12, 0);
const items: WeekItem[] = [
  { id: "1", title: "Deep work: rewrite the onboarding sequence", kind: "task", estMinutes: 240, dueDate: "2026-08-07" },
  { id: "2", title: "Write a first draft of the essay", kind: "task", estMinutes: 180 },
  { id: "3", title: "Long run", kind: "star-step", estMinutes: 60, starId: "fitness" },
  { id: "4", title: "Hard training", kind: "star-step", estMinutes: 75, starId: "fitness" },
  { id: "5", title: "Meditate", kind: "habit", estMinutes: 20 },
  { id: "6", title: "Deep study of the new codebase", kind: "task", estMinutes: 150 },
];

const placedDays = (w: ReturnType<typeof weaveWeek>) => w.days.filter(d => d.woven.placed.length);

describe("week weaver", () => {
  // The one job a week weaver has that a day weaver cannot do. `find` took the
  // first viable day and put four items and 365 minutes on Wednesday while
  // Saturday through Tuesday sat empty.
  it("spreads work across days instead of front-loading", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    expect(placedDays(w).length).toBeGreaterThanOrEqual(4);
    const perDay = w.days.map(d => d.woven.placed.reduce((n, p) => n + p.minutes, 0));
    expect(Math.max(...perDay)).toBeLessThan(360);
  });

  it("never carries two major blocks on one day", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    for (const d of w.days) {
      expect(d.woven.placed.filter(p => p.minutes >= 120).length).toBeLessThanOrEqual(1);
    }
  });

  it("marks the day after a heavy one as recovering, with a lower ceiling", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    for (let i = 1; i < w.days.length; i++) {
      const prevMajor = w.days[i - 1].woven.placed.some(p => p.minutes >= 120);
      if (prevMajor) expect(w.days[i].recovering).toBe(true);
    }
  });

  // "Least loaded" counted only items it had assigned, so a Thursday carrying
  // an eight-hour offsite looked emptier than a Wednesday with one 30-minute
  // task — and the week handed Thursday the four-hour block.
  it("counts existing commitments when choosing a day", () => {
    const busy = "2026-08-06";
    const w = weaveWeek({
      items, startDate, ...AUSTIN,
      commitmentsByDay: { [busy]: [{ startAt: new Date(2026, 7, 6, 9, 0), endAt: new Date(2026, 7, 6, 17, 0), title: "Offsite" }] },
    });
    const thu = w.days.find(d => d.key === busy)!;
    const thuMinutes = thu.woven.placed.reduce((n, p) => n + p.minutes, 0);
    const busiest = Math.max(...w.days.map(d => d.woven.placed.reduce((n, p) => n + p.minutes, 0)));
    expect(thuMinutes).toBeLessThan(busiest);
  });

  it("never schedules past a deadline", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    for (const d of w.days) {
      for (const p of d.woven.placed) {
        if (p.item.dueDate) expect(d.key <= p.item.dueDate).toBe(true);
      }
    }
  });

  it("keeps two steps of one Star off the same day", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    for (const d of w.days) {
      const fitness = d.woven.placed.filter(p => (p.item as WeekItem).starId === "fitness");
      expect(fitness.length).toBeLessThanOrEqual(1);
    }
  });

  // Occupancy is never the target. An open day is a result, and the warning
  // exists so the UI cannot render it as a failure to fill.
  it("says open days are deliberate", () => {
    const w = weaveWeek({ items: [items[0]], startDate, ...AUSTIN });
    expect(w.days.filter(d => d.light).length).toBeGreaterThan(3);
    expect(w.warnings.join(" ")).toMatch(/deliberately open/);
  });

  it("accounts for every item, placed or not", () => {
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    const placedIds = new Set(w.days.flatMap(d => d.woven.placed.map(p => p.item.id)));
    const unplacedIds = new Set(w.unplaced.map(u => u.item.id));
    for (const it of items) {
      expect(placedIds.has(it.id) || unplacedIds.has(it.id), `${it.title} vanished`).toBe(true);
    }
  });

  it("holds an empty week without inventing anything", () => {
    const w = weaveWeek({ items: [], startDate, ...AUSTIN });
    expect(w.days.length).toBe(7);
    expect(w.days.every(d => d.woven.placed.length === 0)).toBe(true);
    expect(w.unplaced).toEqual([]);
  });
});
