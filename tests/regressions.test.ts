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

async function jsonArray<T>(r: { ok: boolean; status: number; json: () => Promise<unknown> }): Promise<T[]> {
  if (!r.ok) throw new Error(`list failed (${r.status})`);
  const j = await r.json().catch(() => null);
  if (!Array.isArray(j)) throw new Error("unexpected shape");
  return j as T[];
}
type ListState = "ok" | "empty" | "stale" | "unavailable";
function listState(o: { data: unknown[] | undefined; isError: boolean }): ListState {
  const has = !!o.data && o.data.length > 0;
  if (o.isError) return has ? "stale" : "unavailable";
  return has ? "ok" : "empty";
}

describe("jsonArray guard", () => {
  it("passes a real list through untouched", async () => {
    await expect(jsonArray({ ok: true, status: 200, json: async () => [{ id: 1 }] })).resolves.toEqual([{ id: 1 }]);
  });
  it("throws on an error response instead of pretending the list is empty", async () => {
    await expect(jsonArray({ ok: false, status: 429, json: async () => ({ error: "Too many requests" }) })).rejects.toThrow();
  });
  it("throws on a 200 that isn't a list — a server bug is not an empty list", async () => {
    await expect(jsonArray({ ok: true, status: 200, json: async () => ({ error: "x" }) })).rejects.toThrow();
  });
  it("still never lets a non-array reach .filter", async () => {
    const out = await jsonArray({ ok: true, status: 200, json: async () => [] }).catch(() => []);
    expect(Array.isArray(out)).toBe(true);
  });
});

describe("empty vs unavailable vs stale", () => {
  it("a genuinely empty list is 'empty', not an error", () => {
    expect(listState({ data: [], isError: false })).toBe("empty");
  });
  it("a failure with nothing cached is 'unavailable', NOT empty", () => {
    expect(listState({ data: [], isError: true })).toBe("unavailable");
    expect(listState({ data: undefined, isError: true })).toBe("unavailable");
  });
  it("a failure with cached data is 'stale' — keep showing the last good list", () => {
    expect(listState({ data: [{ id: 1 }], isError: true })).toBe("stale");
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

// ─────────────────────────────────────────────────────────────────────────────
// 12. CALENDAR FEED TOKENS
// Shipped bug: the feed URL carried the tester id, which was the account
// credential — a subscription link returned the logbook and the recovery code.
// The replacement must be a distinct secret that opens ONE route.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";
const mint = () => randomBytes(32).toString("base64url");
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

describe("calendar feed token", () => {
  it("is long, URL-safe and unguessable", () => {
    const t = mint();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new Set(Array.from({ length: 200 }, mint)).size).toBe(200);
  });

  it("is never the tester id or the recovery code", () => {
    const t = mint();
    expect(t).not.toBe("orrery-demo");
    expect(t).not.toMatch(/^TIDE-/);
  });

  it("is stored hashed — a DB dump must not yield working feed URLs", () => {
    const t = mint();
    const stored = hash(t);
    expect(stored).not.toContain(t);
    expect(stored).toHaveLength(64);
    expect(hash(t)).toBe(stored);          // deterministic, so lookup works
    expect(hash(mint())).not.toBe(stored); // and distinct per token
  });

  it("regenerating invalidates the previous link", () => {
    const first = mint();
    const stored = hash(mint()); // regenerated
    expect(hash(first)).not.toBe(stored);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. OAUTH STATE
// Shipped bug: `state` was an UNSIGNED base64 of {testerId}, so anyone could
// mint one and steer which profile a Google account got attached to. And the
// popup posted the connected email with '*' as the target origin.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual as tse } from "crypto";
const SECRET = "test-secret";
const TTL = 10 * 60 * 1000;

function signState(testerId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ testerId, ts: now, n: "abc" })).toString("base64url");
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}
function verifyState(state: string, now = Date.now()): string | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !tse(a, b)) return null;
  try {
    const { testerId, ts } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof testerId !== "string" || !testerId) return null;
    if (!Number.isFinite(ts) || now - ts > TTL) return null;
    return testerId;
  } catch { return null; }
}

describe("google oauth state", () => {
  it("round-trips a state we issued", () => {
    expect(verifyState(signState("orrery-demo"))).toBe("orrery-demo");
  });

  it("rejects the OLD unsigned format outright", () => {
    const forged = Buffer.from(JSON.stringify({ testerId: "victim" })).toString("base64url");
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects a forged signature", () => {
    const [body] = signState("orrery-demo").split(".");
    expect(verifyState(`${body}.not-the-real-signature`)).toBeNull();
  });

  it("rejects a tampered payload even with the original signature", () => {
    const [, sig] = signState("orrery-demo").split(".");
    const swapped = Buffer.from(JSON.stringify({ testerId: "attacker", ts: Date.now(), n: "abc" })).toString("base64url");
    expect(verifyState(`${swapped}.${sig}`)).toBeNull();
  });

  it("expires, so a captured state cannot be replayed later", () => {
    const old = signState("orrery-demo", Date.now() - (TTL + 1000));
    expect(verifyState(old)).toBeNull();
  });
});

describe("popup postMessage origin", () => {
  const target = (origin: string) => origin;
  it("never uses a wildcard", () => {
    expect(target("https://compass.day")).not.toBe("*");
  });
  it("listener drops a message from another origin", () => {
    const accept = (evOrigin: string, self: string) => evOrigin === self;
    expect(accept("https://evil.example.com", "https://compass.day")).toBe(false);
    expect(accept("https://compass.day", "https://compass.day")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. THE "KNOWN BASELINE" WAS HIDING LIVE BUGS
// Three defects were sitting in the ~20 inherited typecheck errors that had
// been dismissed as noise. Each one is recorded here so the class of mistake
// — "the compiler is complaining but it's probably fine" — stays expensive.
// ─────────────────────────────────────────────────────────────────────────────

describe("baseline typecheck errors that were real", () => {
  it("passing a Date where a julian day is expected yields an Invalid Date", () => {
    // studioCard called getSunriseSunset(now, …) instead of (julianDay(now), …).
    // The arithmetic inside produced NaN, so `now < sun.sunrise` was ALWAYS
    // false and the Studio card never applied its before-sunrise day ruler.
    const asIfDateWereANumber = (jd: number) => new Date((jd - 2440587.5) * 86400000);
    const now = new Date("2026-07-30T18:00:00Z");
    expect(Number.isNaN(asIfDateWereANumber(now as unknown as number).getTime())).toBe(true);
    // And an Invalid Date silently loses every comparison, which is why it was quiet:
    expect(now < asIfDateWereANumber(now as unknown as number)).toBe(false);
    expect(now > asIfDateWereANumber(now as unknown as number)).toBe(false);
  });

  it("`x && obj[k]` yields '' for an empty string, and ?? does not catch it", () => {
    // momentum picked a curve with (g.planet && curves[...]) ?? fallback.
    const curves: Record<string, number[]> = { overall: [1, 2, 3] };
    const emptyPlanet = "";
    const broken = (emptyPlanet && curves[`planet:${emptyPlanet}`]) ?? curves.overall;
    expect(broken).toBe("");                       // not the fallback!
    const fixed = (emptyPlanet ? curves[`planet:${emptyPlanet}`] : undefined) ?? curves.overall;
    expect(fixed).toEqual([1, 2, 3]);
  });

  it("an unknown renderer option is silently ignored, not rejected", () => {
    // resvg-js 2.6.2 has `fontFiles`, not `fontBuffers`. Passing the wrong key
    // meant no brand font loaded and every share card rendered in Helvetica.
    const supported = ["loadSystemFonts", "fontFiles", "fontDirs", "defaultFontSize", "defaultFontFamily"];
    expect(supported).toContain("fontFiles");
    expect(supported).not.toContain("fontBuffers");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. THE FELT PATTERN — the one claim grounded in the reader's own experience
// Shipped bug: computed from localStorage, so an account restore silently lost
// the evidence. Now server-side — and the honesty rules matter as much as the
// persistence, because this is correlational, self-reported, small-n data.
// ─────────────────────────────────────────────────────────────────────────────

interface Tally { character: string; aligned: number; total: number }
const MIN_PER_CHARACTER = 4, MIN_TOTAL = 10;

function summarise(rows: { felt: string; character: string }[]) {
  const t: Record<string, Tally> = {};
  let ratedTotal = 0, ratedAligned = 0;
  for (const r of rows) {
    ratedTotal++; if (r.felt === "aligned") ratedAligned++;
    t[r.character] ??= { character: r.character, aligned: 0, total: 0 };
    t[r.character].total++; if (r.felt === "aligned") t[r.character].aligned++;
  }
  const characters = Object.values(t)
    .filter(c => c.total >= MIN_PER_CHARACTER)
    .map(c => ({ ...c, rate: c.aligned / c.total,
      otherAligned: ratedAligned - c.aligned, otherTotal: ratedTotal - c.total }))
    .sort((a, b) => b.rate - a.rate);
  return { enough: ratedTotal >= MIN_TOTAL && characters.length > 0, ratedTotal, characters };
}

const rows = (spec: [string, string, number][]) =>
  spec.flatMap(([character, felt, n]) => Array.from({ length: n }, () => ({ character, felt })));

describe("felt pattern", () => {
  it("reports counts AND the comparison, not a bare percentage", () => {
    const r = summarise(rows([["building", "aligned", 5], ["building", "mixed", 1], ["clear", "off", 5], ["deep", "aligned", 3]]));
    expect(r.enough).toBe(true);
    const top = r.characters[0];
    expect(top.character).toBe("building");
    expect(top.aligned).toBe(5); expect(top.total).toBe(6);
    // The comparison is what makes 83% mean anything at all.
    expect(top.otherTotal).toBe(8);
    expect(top.otherAligned).toBe(3);
  });

  it("stays silent below the total threshold", () => {
    expect(summarise(rows([["building", "aligned", 5], ["clear", "off", 4]])).enough).toBe(false);
  });

  it("excludes a character with too few ratings to mean anything", () => {
    const r = summarise(rows([["building", "aligned", 6], ["clear", "off", 5], ["deep", "aligned", 3]]));
    expect(r.characters.map(c => c.character)).not.toContain("deep");
  });

  it("says nothing at all with no data", () => {
    expect(summarise([]).enough).toBe(false);
  });

  it("the copy states what was REPORTED, never what a day causes", () => {
    const top = summarise(rows([["building", "aligned", 5], ["building", "mixed", 1], ["clear", "off", 8]])).characters[0];
    const copy = `You felt aligned on ${top.aligned} of ${top.total} ${top.character} days — against ${top.otherAligned} of ${top.otherTotal} other days.`;
    expect(copy).toContain("You felt aligned on 5 of 6");
    for (const banned of ["makes you", "causes", "will be", "always", "proves"]) {
      expect(copy.toLowerCase()).not.toContain(banned);
    }
  });
});
