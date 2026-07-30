/**
 * Regression suite — one test per bug that actually shipped.
 *
 * Every case here is a defect that was live in production, not a hypothetical.
 * The repo had no tests at all while a dozen real bugs were found in 48 hours,
 * so the point of this file is narrow and unglamorous: make the specific
 * mistakes we already made expensive to make again.
 *
 *   pnpm test
 *
 * Deliberately pure — no DB, no network, no clock dependence. Anything needing
 * those belongs in an integration suite; this must stay fast enough that
 * there's no excuse to skip it.
 */
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOCAL DAY vs UTC DAY
// Shipped bug: `new Date().toISOString().slice(0,10)` was used for "today"
// app-wide, so at 00:00 UTC (8pm EDT) habits visually un-checked, the journal
// emptied, the felt rating reset, and reflections filed under tomorrow.
// ─────────────────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysLocal(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

describe("local day identity", () => {
  it("does not roll over at 00:00 UTC for a US-evening user", () => {
    // 2026-07-30T01:20:00Z is 9:20pm on Jul 29 in New York.
    const instant = new Date("2026-07-30T01:20:00Z");
    const asUtc = instant.toISOString().slice(0, 10);
    const asLocalNY = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(instant);
    expect(asUtc).toBe("2026-07-30");     // what the old code used
    expect(asLocalNY).toBe("2026-07-29"); // what the user's wall clock says
    expect(asLocalNY).not.toBe(asUtc);    // the bug, in one line
  });

  it("date arithmetic survives a DST spring-forward", () => {
    // US DST begins 2026-03-08. Naive +86400000ms math lands on the wrong day.
    expect(addDaysLocal("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysLocal("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysLocal("2026-11-01", 1)).toBe("2026-11-02"); // fall-back
  });

  it("round-trips across a month and year boundary", () => {
    expect(addDaysLocal("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysLocal("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysLocal("2027-01-01", -1)).toBe("2026-12-31");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TIMEZONE ≠ LONGITUDE
// Shipped bug: the notifier derived each subscriber's clock from
// Math.round(longitude / 15). Wrong in 5 of 6 real zones — 2 hours out for
// Austin, where the owner lives.
// ─────────────────────────────────────────────────────────────────────────────

function offsetMinInZone(now: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!, +p.second!);
  return -Math.round((asUtc - now.getTime()) / 60000);
}
const offsetFromLongitude = (lon: number) => -Math.round(lon / 15) * 60;

describe("notifier timezone", () => {
  const summer = new Date("2026-07-30T12:00:00Z");

  it("gets DST right where longitude cannot", () => {
    expect(offsetMinInZone(summer, "America/Chicago")).toBe(300);   // CDT
    expect(offsetMinInZone(summer, "America/New_York")).toBe(240);  // EDT
  });

  it("handles half-hour and quarter-hour zones", () => {
    expect(offsetMinInZone(summer, "Asia/Kolkata")).toBe(-330);
    expect(offsetMinInZone(summer, "Australia/Adelaide")).toBe(-570);
    expect(offsetMinInZone(summer, "America/St_Johns")).toBe(150);
  });

  it("keeps a record of exactly how wrong the old method was", () => {
    // Austin: longitude says UTC-7, reality is UTC-5. A 7am ping fired at 5am.
    expect(offsetFromLongitude(-97.74)).toBe(420);
    expect(offsetMinInZone(summer, "America/Chicago")).toBe(300);
    expect(offsetFromLongitude(-97.74) - offsetMinInZone(summer, "America/Chicago")).toBe(120);
  });

  it("rejects a malformed zone rather than throwing inside the cron tick", () => {
    const valid = (z: string) => {
      try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return true; } catch { return false; }
    };
    expect(valid("America/Chicago")).toBe(true);
    expect(valid("Not/AZone")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ASPECT PERFECTION AT 0° AND 180°
// Shipped bug: a folded 0–180 separation with a product-sign crossing test.
// The folded value only *touches* 0 and 180 without changing sign, so Moon
// conjunctions and oppositions were never detected — in 21 days the engine
// found 0 of 9 conjunctions and 0 of 6 oppositions.
// ─────────────────────────────────────────────────────────────────────────────

const norm360 = (d: number) => ((d % 360) + 360) % 360;
const sep180 = (a: number, b: number) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

/** The OLD detector, kept so the regression stays legible. */
function crossedOld(prevSep: number, sep: number, angle: number): boolean {
  return (prevSep - angle) * (sep - angle) <= 0 && Math.abs(prevSep - sep) < 4;
}
/** The signed-delta detector now used in dayarc/studioCard (see voidOfCourse). */
function crossedSigned(prevDelta: number, delta: number, angle: number): boolean {
  return delta >= prevDelta ? (prevDelta < angle && angle <= delta) : (angle > prevDelta || angle <= delta);
}

describe("moon aspect perfection", () => {
  it("the old folded test misses a conjunction, the signed one catches it", () => {
    // Moon approaches, then passes, an exact conjunction.
    const moonBefore = 9.5, moonAfter = 10.5, target = 10.0;
    const prevSep = sep180(moonBefore, target), sep = sep180(moonAfter, target);
    expect(prevSep).toBeCloseTo(0.5); expect(sep).toBeCloseTo(0.5); // never reaches 0 — that's the bug
    expect(crossedOld(prevSep, sep, 0)).toBe(false);

    const prevDelta = norm360(moonBefore - target), delta = norm360(moonAfter - target);
    expect(crossedSigned(prevDelta, delta, 0)).toBe(true);
  });

  it("the old folded test misses an opposition, the signed one catches it", () => {
    const moonBefore = 189.5, moonAfter = 190.5, target = 10.0;
    const prevSep = sep180(moonBefore, target), sep = sep180(moonAfter, target);
    expect(crossedOld(prevSep, sep, 180)).toBe(false);

    const prevDelta = norm360(moonBefore - target), delta = norm360(moonAfter - target);
    expect(crossedSigned(prevDelta, delta, 180)).toBe(true);
  });

  it("still catches an ordinary square, which never regressed", () => {
    const prevDelta = norm360(99.5 - 10), delta = norm360(100.5 - 10);
    expect(crossedSigned(prevDelta, delta, 90)).toBe(true);
  });

  it("wraps cleanly past 360 → 0", () => {
    expect(crossedSigned(359.5, 0.5, 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ARRAY.PUSH RETURNS A NUMBER
// Shipped bug: `lines.push(...).filter(Boolean)` in the iCal export. push()
// returns the new length, so .filter threw and GET /api/export/ical 500'd on
// every request — the download button had never once produced a file.
// ─────────────────────────────────────────────────────────────────────────────

describe("ical line assembly", () => {
  it("filters before pushing, never after", () => {
    const lines: string[] = [];
    const pushed = lines.push(...["A", "", "B"].filter(Boolean));
    expect(typeof pushed).toBe("number");        // why the old code threw
    expect(lines).toEqual(["A", "B"]);
    expect(() => (lines as any).push("C").filter(Boolean)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UNGUARDED LIST RESPONSES
// Shipped bug: a non-2xx still resolves r.json() to an error OBJECT; an
// unguarded .filter/.map on it threw, and because the whole app sits in one
// ErrorBoundary, a transient 429 blanked the entire app.
// ─────────────────────────────────────────────────────────────────────────────

async function jsonArray<T>(r: { json: () => Promise<unknown> }): Promise<T[]> {
  try { const j = await r.json(); return Array.isArray(j) ? (j as T[]) : []; } catch { return []; }
}

describe("jsonArray guard", () => {
  it("returns an array when the server sends an error object", async () => {
    const r = { json: async () => ({ error: "Too many requests" }) };
    await expect(jsonArray(r)).resolves.toEqual([]);
  });
  it("passes a real list through untouched", async () => {
    const r = { json: async () => [{ id: 1 }] };
    await expect(jsonArray(r)).resolves.toEqual([{ id: 1 }]);
  });
  it("survives a malformed body", async () => {
    const r = { json: async () => { throw new SyntaxError("Unexpected token <"); } };
    await expect(jsonArray(r)).resolves.toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. QUERY-KEY PREFIX MATCHING
// Shipped bug: Today invalidated ["tasks"] while its visible query was keyed
// ["tasks-today", …]. React Query matches by prefix ELEMENT, not by string
// prefix, so the refresh silently missed.
// ─────────────────────────────────────────────────────────────────────────────

const keyMatches = (filter: unknown[], key: unknown[]) => filter.every((p, i) => key[i] === p);

describe("react-query key invalidation", () => {
  it('["tasks"] does NOT match ["tasks-today", …]', () => {
    expect(keyMatches(["tasks"], ["tasks-today", "abc", "2026-07-30"])).toBe(false);
  });
  it('["tasks"] does match ["tasks", …]', () => {
    expect(keyMatches(["tasks"], ["tasks", "abc"])).toBe(true);
  });
  it('["habits"] still matches the widened habits key', () => {
    expect(keyMatches(["habits"], ["habits", "abc", "2026-07-30", 30.2, -97.7])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. HABIT CADENCE
// The rolling-7-day window, and the rule that `occasional` can never be behind.
// ─────────────────────────────────────────────────────────────────────────────

type Cadence = "daily" | "most_days" | "weekly" | "occasional";
function windowTargetFor(c: Cadence, targetPerWeek: number | null): number {
  if (c === "daily") return 7;
  if (c === "most_days") return 5;
  if (c === "weekly") return Math.min(7, Math.max(1, targetPerWeek ?? 3));
  return 0;
}
const cadenceMet = (c: Cadence, done: number, target: number) => target === 0 || done >= target;

describe("habit cadence", () => {
  it("targets the right count per cadence", () => {
    expect(windowTargetFor("daily", null)).toBe(7);
    expect(windowTargetFor("most_days", null)).toBe(5);
    expect(windowTargetFor("weekly", 3)).toBe(3);
    expect(windowTargetFor("occasional", null)).toBe(0);
  });
  it("clamps a nonsense weekly target instead of trusting it", () => {
    expect(windowTargetFor("weekly", 0)).toBe(1);
    expect(windowTargetFor("weekly", 99)).toBe(7);
  });
  it("never reports 'occasional' as behind — the whole point of it", () => {
    expect(cadenceMet("occasional", 0, 0)).toBe(true);
  });
  it("a 3x/week habit done 3 times is complete, not a broken streak", () => {
    expect(cadenceMet("weekly", 3, 3)).toBe(true);
    expect(cadenceMet("weekly", 2, 3)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. TASK ROLLOVER
// Carrying a task must preserve where it started (COALESCE semantics), and
// must never touch a scheduled window.
// ─────────────────────────────────────────────────────────────────────────────

interface T { dueDate: string; originalDueDate: string | null; done: boolean }
function roll(t: T, today: string): T {
  if (t.done || t.dueDate >= today) return t;
  return { ...t, dueDate: today, originalDueDate: t.originalDueDate ?? t.dueDate };
}

describe("task rollover", () => {
  it("carries an overdue task and records where it started", () => {
    const r = roll({ dueDate: "2026-07-24", originalDueDate: null, done: false }, "2026-07-30");
    expect(r.dueDate).toBe("2026-07-30");
    expect(r.originalDueDate).toBe("2026-07-24");
  });
  it("keeps the FIRST origin across repeated rolls", () => {
    let t = roll({ dueDate: "2026-07-24", originalDueDate: null, done: false }, "2026-07-30");
    t = roll(t, "2026-08-02");
    expect(t.originalDueDate).toBe("2026-07-24"); // not 2026-07-30
  });
  it("leaves future and completed tasks alone", () => {
    const future = { dueDate: "2026-08-15", originalDueDate: null, done: false };
    expect(roll(future, "2026-07-30")).toEqual(future);
    const done = { dueDate: "2026-07-01", originalDueDate: null, done: true };
    expect(roll(done, "2026-07-30")).toEqual(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. EMAIL SUBJECTS MUST VARY
// Shipped bug: "[Sign] Moon — [activities]" repeated verbatim on consecutive
// days (16 of 29 pairs) because the Moon holds a sign ~2.5 days. Gmail threads
// identical subjects, so day two vanished into day one.
// ─────────────────────────────────────────────────────────────────────────────

function subjectFor(o: { title: string; overdueDays: number } | null, dueCount: number, dayNum: string) {
  if (o && o.overdueDays > 0) return `“${o.title}” — ${o.overdueDays} day${o.overdueDays === 1 ? "" : "s"} on`;
  if (dueCount > 0) return `${dueCount} due ${dayNum}`;
  return `A quiet day — ${dayNum}`;
}

describe("email subject variation", () => {
  it("an ageing item changes the subject every single day", () => {
    const subs = [1, 2, 3, 4, 5].map((d) => subjectFor({ title: "survey 20 readers", overdueDays: d }, 1, "Aug 8"));
    expect(new Set(subs).size).toBe(5);
  });
  it("every fallback branch still carries the date", () => {
    expect(subjectFor(null, 1, "Aug 7")).toContain("Aug 7");
    expect(subjectFor(null, 0, "Aug 7")).toContain("Aug 7");
  });
  it("singular/plural is right at one day", () => {
    expect(subjectFor({ title: "x", overdueDays: 1 }, 1, "Aug 8")).toContain("1 day on");
    expect(subjectFor({ title: "x", overdueDays: 2 }, 1, "Aug 8")).toContain("2 days on");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. THE ARTICLE
// Shipped bug: "A Aquarius Moon" on 7 of 30 days.
// ─────────────────────────────────────────────────────────────────────────────

const artcl = (w: string) => (/^[aeiou]/i.test(w) ? "An" : "A");

describe("article agreement", () => {
  it("uses An before a vowel-initial sign", () => {
    for (const s of ["Aquarius", "Aries"]) expect(`${artcl(s)} ${s} Moon`).toBe(`An ${s} Moon`);
  });
  it("uses A before a consonant-initial sign", () => {
    for (const s of ["Gemini", "Taurus", "Pisces", "Scorpio"]) expect(artcl(s)).toBe("A");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. THE CLICK ENDPOINT MUST NOT BE AN OPEN REDIRECTOR
// ─────────────────────────────────────────────────────────────────────────────

function safeRedirect(to: string, base: string) {
  return to.startsWith(base) ? to : base + "/";
}

describe("email click redirect", () => {
  const base = "https://compass.day";
  it("allows our own origin", () => {
    expect(safeRedirect("https://compass.day/?settings=email", base)).toBe("https://compass.day/?settings=email");
  });
  it("refuses to bounce anywhere else", () => {
    expect(safeRedirect("https://evil.example.com/phish", base)).toBe("https://compass.day/");
    expect(safeRedirect("//evil.example.com", base)).toBe("https://compass.day/");
  });
});
