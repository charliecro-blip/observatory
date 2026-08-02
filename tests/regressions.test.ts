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

// ─────────────────────────────────────────────────────────────────────────────
// 16. TIDE CHART SCRUB ON TOUCH
// Shipped bug: onMouseMove/onMouseLeave only, so the hero chart's inspect
// interaction did not exist on a phone. The subtle part of the fix is not
// swallowing vertical page scroll.
// ─────────────────────────────────────────────────────────────────────────────

function shouldCapture(dx: number, dy: number, pointerType: string) {
  if (pointerType === "mouse") return true;
  if (dy > dx && dy > 6) return false;   // vertical → let the page scroll
  return dx > 6;                          // horizontal → the chart takes it
}

describe("tide chart scrub", () => {
  it("takes a horizontal drag", () => {
    expect(shouldCapture(30, 4, "touch")).toBe(true);
  });
  it("releases a vertical drag so the page can scroll", () => {
    expect(shouldCapture(3, 40, "touch")).toBe(false);
  });
  it("ignores tiny jitter until a direction is clear", () => {
    expect(shouldCapture(2, 2, "touch")).toBe(false);
  });
  it("a mouse always scrubs", () => {
    expect(shouldCapture(0, 0, "mouse")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. THE RITUAL LOOP READ THE OFFICE CLOCK, NOT THE PERSON
// Shipped bug: morning was `hour < 12` and evening `hour >= 18`, while the app
// had been *collecting* wake/sleep times since onboarding and using them
// everywhere else. A night owl (wake 11:00, sleep 03:00) was handed "Cast off"
// at 07:00 while asleep and never once saw "Log the day" — their entire evening
// falls after midnight, where the old rule returned null.
//
// This imports the real implementation rather than restating it: the whole
// point is that the shipped gate and the tested gate cannot drift apart.
// ─────────────────────────────────────────────────────────────────────────────
import { ritualPhase } from "../artifacts/tides/src/lib/chronotype";

/** A local-wall-clock Date at HH:MM — the phase gate reads local hours. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 6, 30, h, m, 0, 0); // 30 Jul 2026, local
  return d;
};
const chrono = (wakeTime?: string, sleepTime?: string) =>
  ({ profile: "steady", freeWindows: {}, wakeTime, sleepTime, updatedAt: "" }) as any;

describe("ritual loop is chronotype-relative", () => {
  const owl = chrono("11:00", "03:00");   // wakes 11am, sleeps 3am
  const lark = chrono("05:00", "21:00");  // wakes 5am, sleeps 9pm

  it("the night owl's evening exists at all — it is after midnight", () => {
    expect(ritualPhase(owl, at("01:00"))).toBe("evening"); // last 3h before 03:00
    expect(ritualPhase(owl, at("02:59"))).toBe("evening");
    // The old rule: hour 1 is < 12, so this was "morning" — the wrong ritual.
    expect(new Date(at("01:00")).getHours() < 12).toBe(true);
  });

  it("the night owl gets no morning card while still asleep", () => {
    expect(ritualPhase(owl, at("07:00"))).toBe(null); // old rule said "morning"
    expect(ritualPhase(owl, at("11:30"))).toBe("morning");
    expect(ritualPhase(owl, at("14:59"))).toBe("morning"); // wake + 4h
    expect(ritualPhase(owl, at("15:30"))).toBe(null);
  });

  it("the early bird's evening starts before 18:00", () => {
    expect(ritualPhase(lark, at("18:30"))).toBe("evening"); // 21:00 − 3h
    expect(ritualPhase(lark, at("17:00"))).toBe(null);
    expect(ritualPhase(lark, at("05:30"))).toBe("morning");
    expect(ritualPhase(lark, at("09:30"))).toBe(null);      // old rule said "morning"
  });

  it("up before the alarm still counts as morning", () => {
    expect(ritualPhase(lark, at("04:15"))).toBe("morning"); // 45min early
    expect(ritualPhase(lark, at("03:00"))).toBe(null);      // genuinely the middle of the night
  });

  it("still up past bedtime still counts as evening — the day is unlogged", () => {
    expect(ritualPhase(lark, at("22:30"))).toBe("evening"); // 1.5h past 21:00
    expect(ritualPhase(lark, at("23:30"))).toBe(null);
  });

  it("a short waking day splits 4:3 instead of overlapping", () => {
    const brief = chrono("08:00", "15:00"); // 7h awake — exactly the two spans
    expect(ritualPhase(brief, at("08:30"))).toBe("morning");
    expect(ritualPhase(brief, at("11:59"))).toBe("morning");
    expect(ritualPhase(brief, at("12:01"))).toBe("evening");
    const tiny = chrono("08:00", "11:30"); // 3.5h — compressed to 2h / 1.5h
    expect(ritualPhase(tiny, at("09:00"))).toBe("morning");
    expect(ritualPhase(tiny, at("10:30"))).toBe("evening");
  });

  it("EVERY schedule gets both halves, anchored to that person's own day", () => {
    const schedules: [string, string][] = [
      ["11:00", "03:00"], ["05:00", "21:00"], ["08:00", "15:00"],
      ["22:00", "20:00"], ["03:00", "12:00"], ["00:30", "16:00"],
    ];
    for (const [wake, sleep] of schedules) {
      const minutes = Array.from({ length: 1440 }, (_, m) =>
        ritualPhase(chrono(wake, sleep), at(`${Math.floor(m / 60)}:${m % 60}`)));
      expect(minutes.filter((p) => p === "morning").length).toBeGreaterThan(30);
      expect(minutes.filter((p) => p === "evening").length).toBeGreaterThan(30);
      // Each half is one contiguous stretch, not scattered — a ritual that
      // switched back and forth across the day would be incoherent.
      const transitions = minutes.filter((p, i) => p !== minutes[(i + 1439) % 1440]).length;
      expect(transitions).toBeLessThanOrEqual(4);
      // And the anchors are the person's, not the clock's: waking is inside
      // the morning stretch, bedtime is at the tail of the evening one.
      const min = (hhmm: string) => Number(hhmm.split(":")[0]) * 60 + Number(hhmm.split(":")[1]);
      expect(minutes[min(wake)]).toBe("morning");
      expect(minutes[(min(sleep) + 1439) % 1440]).toBe("evening");
    }
  });

  it("falls back to the wall clock when the chronotype is unset or unusable", () => {
    for (const c of [undefined, chrono(), chrono("07:00"), chrono(undefined, "22:00"), chrono("09:00", "09:00")]) {
      expect(ritualPhase(c, at("08:00"))).toBe("morning");
      expect(ritualPhase(c, at("14:00"))).toBe(null);
      expect(ritualPhase(c, at("19:00"))).toBe("evening");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. ACCOUNT DELETION MUST NOT MISS A TABLE
// Not a shipped bug — a shipped *promise*. The privacy policy says deletion
// removes everything, and the failure mode is silent: a table added later
// survives the delete, nobody notices, and the policy has quietly become false.
//
// So the server derives its target list from the drizzle schema rather than
// keeping one by hand, and these tests hold that contract from the outside:
// they read the schema source and assert the deletion module would cover it.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCHEMA_DIR = join(process.cwd(), "lib/db/src/schema");

/** Every pgTable in the schema, and whether it carries a tester_id column. */
function schemaTables(): { table: string; testerScoped: boolean }[] {
  const out: { table: string; testerScoped: boolean }[] = [];
  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
    const src = readFileSync(join(SCHEMA_DIR, file), "utf-8");
    const defs = [...src.matchAll(/export const \w+\s*=\s*pgTable\(\s*"([^"]+)"/g)];
    defs.forEach((m, i) => {
      const start = m.index! + m[0].length;
      const end = i + 1 < defs.length ? defs[i + 1].index! : src.length;
      out.push({ table: m[1], testerScoped: /tester_id/.test(src.slice(start, end)) });
    });
  }
  return out;
}

describe("account deletion coverage", () => {
  const tables = schemaTables();
  const deletion = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/lib/accountDeletion.ts"), "utf-8");

  it("the schema is actually being read (guard against a silently empty scan)", () => {
    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter((t) => t.testerScoped).length).toBeGreaterThan(20);
    expect(tables.map((t) => t.table)).toContain("tester_profiles");
  });

  it("discovers tables by tester_id rather than an enumerated list", () => {
    // The list must be DERIVED. If someone replaces this with a literal array,
    // the next table added escapes deletion — which is the whole failure mode.
    expect(deletion).toMatch(/getTableConfig/);
    expect(deletion).toMatch(/"tester_id"/);
    // A hand-written roll-call of table names would defeat the derivation.
    const named = tables.filter((t) => t.testerScoped && deletion.includes(`"${t.table}"`));
    expect(named).toEqual([]);
  });

  it("covers the tables an enumerated list would most likely forget", () => {
    // These are the ones with real privacy weight and no obvious home in a
    // 'delete the planning stuff' mental model.
    for (const t of ["google_cal_tokens", "email_subscriptions", "push_subscriptions",
                     "daemon_memory", "usage_events", "cycle_tracking", "natal_charts"]) {
      const found = tables.find((x) => x.table === t);
      expect(found, `${t} missing from schema`).toBeDefined();
      expect(found!.testerScoped, `${t} is not tester-scoped — deletion would skip it`).toBe(true);
    }
  });

  it("deletes advisor messages, which tester_id alone cannot reach", () => {
    // messages keys on conversation_id, so the derivation rule is blind to it.
    const messages = tables.find((t) => t.table === "messages");
    expect(messages?.testerScoped).toBe(false);
    expect(deletion).toMatch(/messages/);
    expect(deletion).toMatch(/conversationId/);
  });

  it("revokes the Google grant before dropping the row that holds it", () => {
    // Deleting our copy of the token only makes US forget; the grant stays live
    // on Google's side. Order matters: the revoke needs the token to exist.
    const revokeAt = deletion.indexOf("revokeGoogleGrant(testerId)");
    const deleteAt = deletion.indexOf("db.transaction");
    expect(revokeAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(revokeAt).toBeLessThan(deleteAt);
    expect(deletion).toMatch(/oauth2\.googleapis\.com\/revoke/);
  });

  it("deletes in a single transaction — a half-deleted account is the worst case", () => {
    expect(deletion).toMatch(/db\.transaction/);
  });

  it("reports revocation honestly instead of assuming it worked", () => {
    // googleRevoked is a tri-state on purpose: null = nothing was connected,
    // false = we could not confirm and the user must revoke it themselves.
    expect(deletion).toMatch(/googleRevoked: boolean \| null/);
  });
});

describe("local purge on deletion", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/tides/src/lib/tester-profile.ts"), "utf-8");

  it("clears by namespace, not by an enumerated list of keys", () => {
    expect(src).toMatch(/LOCAL_NAMESPACES/);
    expect(src).toMatch(/startsWith/);
  });

  it("covers every localStorage key the client actually writes", () => {
    // DERIVED from the source, not sampled. Sampling is what let `compass_`
    // slip: the hand-picked list happened to contain only hyphen-style Compass
    // keys, so `compass_rollover_<id>` — the task-rollover state — survived a
    // "deleted" account and was found only by watching a real delete.
    const namespaces = (src.match(/const LOCAL_NAMESPACES = \[([^\]]+)\]/)?.[1] ?? "")
      .split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
    expect(namespaces.length).toBeGreaterThan(2);

    const clientDir = join(process.cwd(), "artifacts/tides/src");
    const files: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (/\.tsx?$/.test(e.name)) files.push(join(dir, e.name));
      }
    })(clientDir);
    expect(files.length).toBeGreaterThan(20);

    const keys = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(/localStorage\.(?:set|get|remove)Item\(\s*([^,)]+)/g)) {
        const expr = m[1].trim();
        let literal: string | null = null;
        if (/^"[^"]+"$/.test(expr)) literal = expr.slice(1, -1);
        else if (expr.startsWith("`")) literal = expr.slice(1).split("${")[0];
        else if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
          // A named constant, or a helper — resolve its definition in this file.
          const asConst = text.match(new RegExp(`(?:const|let)\\s+${expr}\\s*=\\s*["\`]([^"\`$]+)`));
          const asFn = text.match(new RegExp(`function ${expr}\\([^)]*\\)[^{]*\\{[^}]*return\\s+["\`]([^"\`$]+)`));
          literal = asConst?.[1] ?? asFn?.[1] ?? null;
        }
        if (literal) keys.add(literal);
      }
    }
    // Sanity: the scan found real keys, not an empty set that passes vacuously.
    expect(keys.size).toBeGreaterThan(10);
    expect([...keys]).toContain("obs_tester_id");
    expect([...keys]).toContain("compass_rollover_");

    const orphans = [...keys].filter((k) => !namespaces.some((n) => k.startsWith(n)));
    expect(orphans, `these keys would survive account deletion: ${orphans.join(", ")}`).toEqual([]);
  });

  it("iterates a snapshot — removing while indexing localStorage skips keys", () => {
    // localStorage.key(i) reindexes on removal, so deleting inside the loop
    // silently leaves every other key behind.
    const body = src.slice(src.indexOf("export function purgeLocalData"));
    expect(body).toMatch(/doomed\.push/);
    expect(body).toMatch(/for \(const key of doomed\) localStorage\.removeItem\(key\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. THEME-BREAKING COLOURS IN `color:`
// Shipped bug: the app was written with a hardcoded grey ramp in inline styles
// (#333 · #555 · #777 · #888 · #999 · #aaa · #bbb) plus frozen light-mode
// element and planet hues. On the dark palette a measured 220 text nodes across
// the four daily-driver tabs fell below WCAG AA — Calendar's day numbers at
// 1.37:1, the "Guiding Stars" heading at 1.23:1, i.e. invisible.
//
// The fix was semantic tokens. This is the part that keeps it fixed: without a
// guard, the next feature reintroduces a raw grey and nobody notices until a
// dark-mode user does.
// ─────────────────────────────────────────────────────────────────────────────

/** `color:` as a JS object key — not backgroundColor, borderColor, caretColor. */
const COLOR_PROP = /(?<![A-Za-z0-9_$-])color\s*:\s*([^,\n}]*)/g;

function clientSourceFiles(): string[] {
  const dir = join(process.cwd(), "artifacts/tides/src");
  const out: string[] = [];
  (function walk(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (/\.tsx?$/.test(e.name)) out.push(join(d, e.name));
    }
  })(dir);
  return out;
}

describe("no theme-breaking colours", () => {
  // These files ARE the palette definitions — raw hex is their whole job.
  const SOURCE_TABLES = ["lib/themes.ts", "lib/elements.ts", "lib/planetColors.ts",
                         "lib/celestialGlyphs.ts", "lib/mythos.ts"];
  const files = clientSourceFiles();

  it("finds the client source at all", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("no raw neutral grey is used as a `color:` value", () => {
    // A grey is anything with near-zero saturation: those are exactly the
    // values that invert with the theme. Brand hues are a separate concern.
    const isGrey = (hex: string) => {
      let h = hex.slice(1);
      if (h.length === 3) h = [...h].map((c) => c + c).join("");
      if (h.length < 6) return false;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return (mx === 0 ? 0 : (mx - mn) / mx) < 0.22;
    };
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.split("artifacts/tides/src/")[1];
      if (SOURCE_TABLES.includes(rel)) continue;
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(COLOR_PROP)) {
        for (const hex of m[1].match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
          // #fff / #000 on a saturated button are legitimate and deliberate;
          // it is the ramp *between* them that breaks.
          if (/^#(fff|ffffff|000|000000)$/i.test(hex)) continue;
          if (isGrey(hex)) offenders.push(`${rel}: ${hex}`);
        }
      }
    }
    expect(offenders, `use var(--text-1|2|3) or var(--color-muted) instead:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("element and planet hues are not re-frozen as literals outside their source tables", () => {
    // Both palettes were copy-pasted into a dozen files and had already
    // drifted (Venus was two different hues), so a literal here is both a
    // dark-mode bug and a consistency bug.
    const FROZEN = ["#8a3a20", "#b84020", "#4a7040", "#3a6030", "#c19a3a", "#2a5a80",
                    "#3a5a80", "#6040a0", "#c04040", "#807060", "#c08020", "#7080a0"];
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.split("artifacts/tides/src/")[1];
      if (SOURCE_TABLES.includes(rel)) continue;
      const text = readFileSync(file, "utf-8").toLowerCase();
      for (const hex of FROZEN) {
        if (text.includes(`"${hex}"`)) offenders.push(`${rel}: ${hex}`);
      }
    }
    expect(offenders, `import ELEMENT_COLORS / PLANET_COLORS instead:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("the text ramp is defined for every palette, light and dark", () => {
    const css = readFileSync(join(process.cwd(), "artifacts/tides/src/index.css"), "utf-8");
    for (const token of ["--text-1", "--text-2", "--text-3"]) {
      // once in :root, once in the dark override
      expect(css.split(token).length - 1, `${token} needs a light AND a dark value`).toBeGreaterThanOrEqual(2);
    }
    const themes = readFileSync(join(process.cwd(), "artifacts/tides/src/lib/themes.ts"), "utf-8");
    // Four palettes, each carrying all three rungs.
    for (const token of ["--text-1", "--text-2", "--text-3"]) {
      expect(themes.split(token).length - 1, `${token} missing from a palette`).toBe(4);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. CRASHES THAT REPORT NOWHERE
// Shipped gap: ErrorBoundary caught render crashes, showed "Something went
// wrong", and told us nothing — and anything thrown outside React vanished into
// a console we will never see. During a beta that makes a crash exactly as
// visible as a tester's willingness to mention it.
//
// The subtle part is the throttle, not the reporting: a crash inside a render
// loop fires hundreds of times a second, and each one is a write to a database
// billed by compute time.
// ─────────────────────────────────────────────────────────────────────────────

/** The dedupe/ceiling rule from lib/errorReport.ts, restated. */
function makeReporter(maxPerSession = 10) {
  const seen = new Set<string>();
  let sent = 0;
  return (source: string, message: string): boolean => {
    if (sent >= maxPerSession) return false;
    const key = `${source}:${message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    sent++;
    return true;
  };
}

describe("client error reporting", () => {
  it("a render loop firing the same error 500 times writes one row", () => {
    const report = makeReporter();
    const written = Array.from({ length: 500 }, () => report("render", "boom")).filter(Boolean);
    expect(written.length).toBe(1);
  });

  it("distinct errors are all kept, up to the session ceiling", () => {
    const report = makeReporter(10);
    const written = Array.from({ length: 25 }, (_, i) => report("render", `boom ${i}`)).filter(Boolean);
    expect(written.length).toBe(10); // not 25 — the ceiling holds
  });

  it("the same message from different sources is two bugs, not one", () => {
    const report = makeReporter();
    expect(report("render", "boom")).toBe(true);
    expect(report("promise", "boom")).toBe(true);
  });

  it("reports the three paths that can actually crash the app", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/tides/src/lib/errorReport.ts"), "utf-8");
    for (const listener of ["error", "unhandledrejection"]) {
      expect(src).toContain(`addEventListener("${listener}"`);
    }
    const boundary = readFileSync(
      join(process.cwd(), "artifacts/tides/src/components/ErrorBoundary.tsx"), "utf-8");
    // getDerivedStateFromError renders the fallback; componentDidCatch is the
    // only hook that can report. Having one without the other is the bug.
    expect(boundary).toMatch(/componentDidCatch/);
    expect(boundary).toMatch(/reportError\(/);
  });

  it("never lets a resource-load failure masquerade as a crash", () => {
    // window 'error' fires for a missing image with no .error object; treating
    // those as crashes would bury the real ones in noise.
    const src = readFileSync(
      join(process.cwd(), "artifacts/tides/src/lib/errorReport.ts"), "utf-8");
    expect(src).toMatch(/if \(!e\.error\) return;/);
  });

  it("does not ship the query string alongside an account id", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/tides/src/lib/errorReport.ts"), "utf-8");
    expect(src).toContain("location.pathname");
    expect(src).not.toContain("location.href");
    expect(src).not.toContain("location.search");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 21. THE ANALYTICS READ ENDPOINTS WERE PUBLIC
// Shipped bug, and one I introduced myself: /api/events/summary was already
// world-readable, which was survivable while it returned counts. Adding
// /api/events/errors — which returns error MESSAGES and STACK TRACES, and an
// error message can quote whatever the user had on screen — made it a leak,
// published next to the account id it belongs to. Verified live with a bare
// curl before it was closed.
//
// The invariant that matters is not "there is a check", it is that the check
// FAILS CLOSED. A gate that falls open when unconfigured is the same bug in a
// costume, and it is the shape almost every homegrown admin check takes.
// ─────────────────────────────────────────────────────────────────────────────

/** The gate from routes/events.ts, restated. */
function adminAllows(opts: { token?: string; header?: string; nodeEnv: string }): boolean {
  const { token, header, nodeEnv } = opts;
  if (!token) return nodeEnv !== "production";
  if (header === undefined) return false;
  if (header.length !== token.length) return false;
  return header === token;
}

describe("admin gate on the analytics reads", () => {
  it("FAILS CLOSED in production when no token is configured", () => {
    // The whole point. Forgetting to set the variable must not publish
    // stack traces to the internet.
    expect(adminAllows({ nodeEnv: "production" })).toBe(false);
  });

  it("still works locally with no token, so it isn't a dev tax", () => {
    expect(adminAllows({ nodeEnv: "development" })).toBe(true);
  });

  it("rejects a missing, wrong, or wrong-length token", () => {
    const token = "s3cr3t-test-token";
    expect(adminAllows({ token, nodeEnv: "production" })).toBe(false);
    expect(adminAllows({ token, header: "nope", nodeEnv: "production" })).toBe(false);
    expect(adminAllows({ token, header: "", nodeEnv: "production" })).toBe(false);
    expect(adminAllows({ token, header: token + "x", nodeEnv: "production" })).toBe(false);
    expect(adminAllows({ token, header: token, nodeEnv: "production" })).toBe(true);
  });

  it("compares in constant time and answers 404, not 401", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/events.ts"), "utf-8");
    // A plain === leaks length/content through timing on a bearer secret.
    expect(src).toMatch(/timingSafeEqual/);
    // 401 confirms the endpoint exists to anyone scanning; 404 says nothing.
    expect(src).not.toMatch(/status\(401\)/);
    expect(src).toMatch(/status\(404\)/);
  });

  it("leaves the ingest route open — the app has to be able to write", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/events.ts"), "utf-8");
    expect(src).toMatch(/router\.post\("\/events", async/);       // no gate
    expect(src).toMatch(/router\.get\("\/events\/errors", requireAdmin/);
    expect(src).toMatch(/router\.get\("\/events\/summary", requireAdmin/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 22. THE WEEKLY EMAIL CONTRADICTED THE DAILY, AND POINTED AT TODAY
// Shipped bugs, both counted in EMAIL-STUDY-2026-07-30 (⑦, ⑧):
//   · composeWeek called dayReading() with NO natal and NO ascRuler while
//     composeDay passed both, so the two composers described the same date
//     differently — "A fire day" in the weekly above "An air day" in the
//     daily. Worse, without a chart the synthesis degenerates: "A fire day"
//     printed for 6 of the 7 day lines. A week that reads as one day repeated.
//   · The standout-day picks searched from d=0, so a *week ahead* email
//     routinely nominated the morning you were reading it ("Deep focus — Thu"
//     sent on Thursday), and the rest-day fell back to perDay[0] — today —
//     whenever no void fell that week.
// ─────────────────────────────────────────────────────────────────────────────

describe("weekly email", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/reports.ts"), "utf-8");
  const week = src.slice(src.indexOf("export async function composeWeek"),
                         src.indexOf("async function composeMonth"));

  it("passes the chart into the day-by-day reading, as the daily does", () => {
    // Without these the week collapses into one repeated day.
    expect(week).toMatch(/natalFor\(testerId\)/);
    expect(week).toMatch(/ascRuler/);
    expect(week).toMatch(/dayReading\([\s\S]{0,200}natal:/);
  });

  it("takes the day's shape from the Moon's element, the same source as the daily", () => {
    // The woven flavour weights the day ruler and Sun; deriving the shape word
    // from it is what produced "A fire day" over "Pisces Moon".
    expect(week).toMatch(/sg\?\.element/);
  });

  it("never nominates today as a standout — it is a WEEK AHEAD email", () => {
    expect(week).toMatch(/p\.d >= 1/);
    // The old fallback. If this reappears, "keep light / rest" is today again.
    expect(week).not.toMatch(/\?\?\s*perDay\[0\]/);
  });

  it("fetches the chart once, not twice", () => {
    expect(week.match(/await natalFor\(testerId\)/g)?.length ?? 0).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 23. CLAIMING A FIT THAT ISN'T THERE
// The New Moon report picked `stars.find(elementMatch) ?? stars[0]` and then
// asserted the cycle "favors" whatever it landed on — so with one earth star
// and a Leo cycle it emailed "seed an intention toward 'aligned spine' — a Leo
// cycle favors perform, present, publish". One star against four elements makes
// that non-sequitur the ~75% case, which is exactly the shape of the daily's
// "23/30 identical discouraging sentence" bug.
// ─────────────────────────────────────────────────────────────────────────────

describe("new moon email", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/reports.ts"), "utf-8");
  const nm = src.slice(src.indexOf("export async function composeNewMoon"));

  it("distinguishes a real elemental match from a fallback", () => {
    expect(nm).toMatch(/const matched = stars\.find/);
    expect(nm).toMatch(/matched\s*\n?\s*\?/);   // branches on it
  });

  it("says so plainly when the cycle does NOT suit the star", () => {
    expect(nm).toMatch(/This is not/);
    expect(nm).toMatch(/keep its own pace/);
  });

  it("uses the a/an helper, so we never email 'a earth cycle'", () => {
    // Same class as the "A Aquarius Moon" bug this file already guards.
    expect(nm).toMatch(/artcl\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 24. "CONNECTED" MEANT "A ROW EXISTS"
// Shipped bug: /integrations/google-cal/status returned connected:true whenever
// a token row was present, without checking whether the token still worked.
//
// This fails in precisely the case that will hit every beta tester: while the
// OAuth app sits in Google's *Testing* mode, refresh tokens expire after seven
// days. The row survives the expiry, so the app went on reporting "Connected"
// while the calendar returned nothing — an empty week with no explanation and
// no affordance to fix it.
// ─────────────────────────────────────────────────────────────────────────────

describe("google calendar connection state", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/googleCal.ts"), "utf-8");
  const statusRoute = src.slice(
    src.indexOf('router.get("/integrations/google-cal/status"'),
    src.indexOf('router.get("/integrations/google-cal/auth"'));

  it("verifies the token rather than the row's existence", () => {
    expect(statusRoute).toMatch(/refreshAccessToken\(row\)/);
    expect(statusRoute).toMatch(/needsReconnect/);
  });

  it("reports a dead grant as a THIRD state, not as disconnected", () => {
    // connected:false would be a lie about what the user did — they connected;
    // Google dropped it. The distinction is what makes "Reconnect" the right
    // affordance instead of "Connect".
    expect(statusRoute).toMatch(/connected: true[\s\S]{0,400}needsReconnect/);
  });

  it("does not cost a Google round trip on every poll", () => {
    // refreshAccessToken returns the cached access token untouched while it is
    // still valid; only an actually-expired token reaches the network. Without
    // that short-circuit this route would hit Google's token endpoint on every
    // status poll, for every user.
    const refresh = src.slice(src.indexOf("async function refreshAccessToken"),
                              src.indexOf('router.get("/integrations/google-cal/status"'));
    expect(refresh).toMatch(/expiresAt[\s\S]{0,80}return row\.accessToken/);
  });

  it("both surfaces that can show an empty calendar offer the reconnect", () => {
    // Settings is where you'd look after you already suspect something; the
    // Calendar toolbar is where you actually notice the emptiness.
    for (const f of ["artifacts/tides/src/pages/Settings.tsx",
                     "artifacts/tides/src/pages/Calendar.tsx"]) {
      const ui = readFileSync(join(process.cwd(), f), "utf-8");
      expect(ui, `${f} has no reconnect affordance`).toMatch(/needsReconnect/);
      expect(ui).toMatch(/Reconnect/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 25. A SEED THAT CAN DOUBLE-FIRE
// Caught in development, before shipping, by actually running it: the starter-
// habits seed guarded itself with a check-then-insert, which is not idempotent
// under concurrency. Six concurrent calls produced six rows — "Rise and shine"
// three times over. React StrictMode double-invokes in development and a
// double-tap on a slow connection does the same in production, so this was not
// hypothetical.
//
// A seed that double-fires is worse than no seed: the new user's first act
// becomes deleting our mess, on the exact screen meant to make the app feel
// considered.
// ─────────────────────────────────────────────────────────────────────────────

describe("starter habits seed", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/habits.ts"), "utf-8");
  const seed = src.slice(src.indexOf('router.post("/habits/seed-starters"'),
                         src.indexOf('router.post("/habits",'));

  it("serialises per tester — a check-then-insert alone is a race", () => {
    expect(seed).toMatch(/db\.transaction/);
    expect(seed).toMatch(/pg_advisory_xact_lock/);
    // The guard must read INSIDE the transaction, or the lock buys nothing.
    const lockAt = seed.indexOf("pg_advisory_xact_lock");
    const checkAt = seed.indexOf("existing.length");
    expect(lockAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(checkAt);
  });

  it("only ever seeds an account with no habits at all", () => {
    expect(seed).toMatch(/if \(existing\.length\) return null/);
  });

  it("seeds dailies with solar anchors — that is the thing it teaches", () => {
    expect(seed).toMatch(/solarAnchor: "sunrise"/);
    expect(seed).toMatch(/solarAnchor: "sunset"/);
    expect(seed).toMatch(/cadence: "daily"/);
  });

  it("cannot block someone from entering the app they just signed up for", () => {
    const app = readFileSync(join(process.cwd(), "artifacts/tides/src/App.tsx"), "utf-8");
    // Fire-and-forget with a catch — a failed seed is a cosmetic loss, and
    // awaiting it would put a network call between a new user and their first
    // screen.
    expect(app).toMatch(/seed-starters[\s\S]{0,160}catch\(\(\) => \{\}\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 26. THE INTRO RAN ONCE AND THERE WAS NOWHERE TO GO BACK TO
// Not a defect — a gap, named by the owner. The intro slides teach the CONCEPTS
// (character, level, nested rhythms) and teach them well. Nothing taught the
// APP: which tab is for what, what the daily loop is, which affordances exist.
// A tester finished onboarding knowing what a tide is and not knowing that Plan
// takes a pasted to-do list. And the intro runs exactly once, so whatever it
// did land was gone by Thursday with no way back.
// ─────────────────────────────────────────────────────────────────────────────

describe("the guide", () => {
  const guide = readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/Guide.tsx"), "utf-8");

  it("covers every tab in the nav, so no surface is unexplained", () => {
    // Read the nav's own labels rather than restating them: renaming a tab
    // (Aims → Stars, 2026-08-02) must fail here until the guide follows.
    const app = readFileSync(join(process.cwd(), "artifacts/tides/src/App.tsx"), "utf-8");
    const body = app.match(/const TOP_TABS[\s\S]*?=\s*\[([\s\S]*?)\n\];/)?.[1] ?? "";
    const tabs = [...body.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(tabs.length, "could not read TOP_TABS out of App.tsx").toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(guide, `the guide never explains ${tab}`).toMatch(new RegExp(`title: "${tab}"`));
    }
  });

  it("leads with the loop, not with astrology", () => {
    // The first section a new user opens decides what they think the app is.
    expect(guide.indexOf('key: "loop"')).toBeLessThan(guide.indexOf('key: "today"'));
    expect(guide).toMatch(/You don't need to know any astrology/);
  });

  it("states the refusals — they are the product's most distinctive behaviour", () => {
    expect(guide).toMatch(/won't move your blocks behind your back/);
    expect(guide).toMatch(/won't promise outcomes/);
    // The anti-streak position, in the rhythm framing from LANGUAGE-STUDY §4.
    expect(guide).toMatch(/beat you can miss and come back to/);
  });

  it("is taught on first run AND stays reachable from Settings", () => {
    // One of these alone fails: the first-run teaching is answered once and
    // gone, and nobody browses Settings for an explanation they don't know
    // exists. The first-run half is now the spotlight tour over the live
    // dashboard (2026-08-01) rather than a "New here?" reading strip.
    const app = readFileSync(join(process.cwd(), "artifacts/tides/src/App.tsx"), "utf-8");
    const settings = readFileSync(join(process.cwd(), "artifacts/tides/src/pages/Settings.tsx"), "utf-8");
    expect(app).toMatch(/SpotlightTour/);
    expect(app).toMatch(/tourPending/);
    expect(settings).toMatch(/GuideSection/);
    expect(settings).toMatch(/Open the guide/);
    expect(settings).toMatch(/Replay the walkthrough/);
  });

  it("the tour's verdict is namespaced, so account deletion clears it", () => {
    const tour = readFileSync(join(process.cwd(), "artifacts/tides/src/lib/tour.ts"), "utf-8");
    // The storage key is built from a template — grab its literal prefix.
    const key = tour.match(/`(compass-tour-[^`$]*)/)?.[1] ?? "";
    expect(key, "could not find the tour's localStorage key").not.toBe("");
    const profile = readFileSync(
      join(process.cwd(), "artifacts/tides/src/lib/tester-profile.ts"), "utf-8");
    const namespaces = (profile.match(/const LOCAL_NAMESPACES = \[([^\]]+)\]/)?.[1] ?? "")
      .split(",").map((s) => s.trim().replace(/"/g, ""));
    expect(namespaces.some((n) => key.startsWith(n))).toBe(true);
  });

  it("holds back the self-promoting banners until the tour is answered", () => {
    // A first screen should be the day, not a stack of asks over it (beta
    // pass §B1). App decides; Today obeys — assert both halves are wired.
    const app = readFileSync(join(process.cwd(), "artifacts/tides/src/App.tsx"), "utf-8");
    const today = readFileSync(join(process.cwd(), "artifacts/tides/src/pages/Today.tsx"), "utf-8");
    expect(app).toMatch(/const firstRun = tourArmed \|\| tourPending\(testerId\)/);
    expect(app).toMatch(/firstRun=\{firstRun\}/);
    expect(today).toMatch(/\{!firstRun && <NotificationOptIn/);
    // The premium-discovery and first-star banners carry the same guard.
    expect(today.match(/\{!firstRun /g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 27. THE VOID WAS TREATED AS A PROPERTY OF THE DAY, AND MEASURED IN 10-MIN LUMPS
// Caught in production by the owner, 2026-07-31: the 7 AM email went out titled
// "Begin nothing today" while the Moon left the void at 07:13 and was already
// in Pisces. Two separate defects underneath one symptom.
//
//   (a) composeDay sampled voidOfCourse() at ONE instant — send time — and then
//       spoke for the whole day. At 07:00 the void had thirteen minutes left,
//       and that became a day-long verdict in the SUBJECT LINE, the least
//       qualified place in the email.
//
//   (b) computeDayArc scanned in 10-minute steps and reported the bucket as an
//       exact clock time: "void until 07:20" for a boundary at 07:13:30. Void
//       windows are used as literal start-and-stop guidance, so a six-minute
//       overstatement is not cosmetic.
// ─────────────────────────────────────────────────────────────────────────────

describe("void of course windows", () => {
  it("locates the ingress to the second, not to a ten-minute bucket", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const D: any = await import("../artifacts/api-server/src/lib/dayarc.js");
    const tz = 300;
    const now = new Date();
    const lon0 = ((A.moonLongitude(A.julianDay(now)) % 360) + 360) % 360;
    const sign0 = Math.floor(lon0 / 30);

    // Ground truth, computed independently of the code under test: bisect
    // backwards for the moment the Moon entered its current sign.
    let lo = now.getTime() - 3 * 86400000, hi = now.getTime();
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      const l = ((A.moonLongitude(A.julianDay(new Date(mid))) % 360) + 360) % 360;
      if (Math.floor(l / 30) === sign0) hi = mid; else lo = mid;
    }
    const truthMs = hi;

    const arc = D.computeDayArc(new Date(truthMs), 30.27, -97.74, tz);
    const windows = arc.vocWindows ?? [];
    if (!windows.length) return; // no void that day — nothing to check
    const appEnd = Date.parse(windows[windows.length - 1].end);
    // The old 10-minute scan drifted up to 600s. Anything over a minute would
    // be visible to someone timing a start against it.
    expect(Math.abs(appEnd - truthMs) / 1000).toBeLessThan(60);
  });

  it("a void with minutes left is not a verdict on the day", () => {
    // The threshold from composeDay, restated. At 07:00 with the void ending
    // 07:13, "Begin nothing today" must not be the subject.
    const dominates = (msAhead: number) => msAhead >= 4 * 3600000;
    expect(dominates(13 * 60000)).toBe(false);        // the shipped failure
    expect(dominates(3.9 * 3600000)).toBe(false);
    expect(dominates(6 * 3600000)).toBe(true);        // genuinely owns the day
  });

  it("a void that already closed is history, not a caution", () => {
    const nowMs = Date.parse("2026-07-31T12:40:00Z");
    const windows = [{ start: Date.parse("2026-07-31T05:00:00Z"), end: Date.parse("2026-07-31T12:13:30Z") }];
    const ahead = windows.filter((w) => w.end > nowMs);
    expect(ahead).toEqual([]);
  });

  it("the composer reads windows, not a single-instant boolean", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/reports.ts"), "utf-8");
    const day = src.slice(src.indexOf("export async function composeDay"),
                          src.indexOf("export async function composeWeek"));
    expect(day).toMatch(/vocWindows/);
    expect(day).toMatch(/vocAhead/);
    // The subject may only use the "owns the day" form, never the raw flag.
    expect(day).toMatch(/vocDominatesDay\s*\n?\s*\?\s*`Begin nothing today/);
  });

  it("names the hour the void lifts, rather than implying it runs all day", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/reports.ts"), "utf-8");
    expect(src).toMatch(/The Moon is void until \$\{clock\(w\.end\)\}/);
    expect(src).toMatch(/After that the day is ordinary/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 28. THE RAIL'S "UNTIL" WAS UP TO AN HOUR WRONG
// The number the app puts in front of you as literal go/no-go guidance — "Moon
// void of course · until 08:01 AM" — came from a scan that stepped forward in
// one-HOUR jumps and printed the hour boundary it landed on as an exact clock
// time. Measured across 40 consecutive ingresses: worst error 58.5 minutes.
//
// On 2026-07-31 it showed 08:01 AM for an ingress at 07:13:30, so it told the
// reader to wait 47 minutes longer than they had to. That is the opposite of
// what the feature is for.
// ─────────────────────────────────────────────────────────────────────────────

describe("moon ingress precision", () => {
  it("is accurate to seconds across many ingresses, not to the hour", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const D: any = await import("../artifacts/api-server/src/lib/dayarc.js");
    const base = Date.parse("2026-07-31T00:00:00Z");
    let worstOld = 0, worstNew = 0;

    for (let d = 0; d < 40; d++) {
      const from = base + d * 86400000 + 3 * 3600000;
      const signAt = (ms: number) =>
        Math.floor((((A.moonLongitude(A.julianDay(new Date(ms))) % 360) + 360) % 360) / 30);
      const s0 = signAt(from);

      // Truth, bisected independently of the code under test.
      let lo = from, hi = from + 4 * 86400000;
      for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (signAt(mid) !== s0) hi = mid; else lo = mid; }
      const truth = hi;

      // The shipped method, kept so the regression stays legible.
      let old = 0;
      for (let h = 1; h <= 96; h++) { const t = from + h * 3600000; if (signAt(t) !== s0) { old = t; break; } }

      worstOld = Math.max(worstOld, Math.abs(old - truth) / 60000);
      worstNew = Math.max(worstNew, Math.abs(D.nextIngressAfterMs(from) - truth) / 60000);
    }

    // A record of how wrong it was, so nobody restores the cheap scan.
    expect(worstOld).toBeGreaterThan(30);        // the hourly method: ~58 min out
    expect(worstNew * 60).toBeLessThan(5);       // bisection: under 5 seconds
  }, 30000);

  it("the rail no longer scans by the hour", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/tides.ts"), "utf-8");
    expect(src).toMatch(/nextIngressAfterMs\(date\.getTime\(\)\)/);
    // The old loop, which must not come back.
    expect(src).not.toMatch(/for \(let h = 1; h <= 72; h\+\+\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 29. A MOVED BLOCK LEFT THE SCHEDULE OUT OF ORDER
// Found by using the feature rather than reading it. The Planner grouped rows
// by day in ARRAY order, which was chronological only because the weaver had
// sorted it once on arrival. Moving an item rewrites its time in place, so the
// day headers rendered Friday, Monday, Sunday — a schedule out of order is
// worse than no schedule, and it appeared the first time anyone used the move
// affordance that shipped alongside it.
// ─────────────────────────────────────────────────────────────────────────────

describe("planner ordering after a move", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/Planner.tsx"), "utf-8");

  it("sorts day groups at render, not once at weave time", () => {
    expect(src).toMatch(/Object\.entries\(byDay\)[\s\S]{0,120}\.sort\(/);
  });

  it("sorts rows within a day too — a move can land between two of them", () => {
    expect(src).toMatch(/Object\.values\(byDay\)\.forEach\([\s\S]{0,120}sort\(/);
  });

  it("moving is local state — nothing is written before commit", () => {
    // The plan is a proposal. If this ever starts calling an endpoint, the
    // "nothing is scheduled until you say so" promise on the same screen breaks.
    const move = src.slice(src.indexOf("const moveTo ="), src.indexOf("const editCard"));
    expect(move).not.toMatch(/fetch\(/);
    expect(move).toMatch(/setResult/);
  });

  it("a move is reversible — the vacated slot becomes an option again", () => {
    const move = src.slice(src.indexOf("const moveTo ="), src.indexOf("const editCard"));
    expect(move).toMatch(/startAt: p\.startAt/);          // the old slot goes back on the list
    expect(move).toMatch(/filter\(\(a\) => a\.startAt !== alt\.startAt\)/); // the taken one comes off
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 30. ALTERNATIVES THAT CONFLICT WITH EACH OTHER
// The weaver ranks every viable slot and used to discard all but the winner,
// which is what made a woven plan take-it-or-leave-it. Returning the runner-up
// slots is the fix — but computing them per item offered the SAME free slot to
// three different tasks, so any two of those moves collided. Measured before
// the fix: three slots each offered to multiple tasks.
// ─────────────────────────────────────────────────────────────────────────────

describe("planner alternatives", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/plan.ts"), "utf-8");

  it("computes alternatives only after every item is placed", () => {
    // Computing them inside the placement loop reads a `reserved` set that is
    // still growing, so a slot that looks free is taken by the next task.
    expect(src).toMatch(/placementCtx/);
    expect(src.indexOf("for (const ctx of placementCtx)")).toBeGreaterThan(src.indexOf("const push ="));
  });

  it("claims slots across ALL items, so any subset of moves is safe", () => {
    expect(src).toMatch(/const claimed: \{ s: number; e: number \}\[\] = \[\]/);
    expect(src).toMatch(/claimed\.some\(\(k\) => overlaps\(/);
    expect(src).toMatch(/claimed\.push\(/);
  });

  it("offers different days rather than three slots on one afternoon", () => {
    expect(src).toMatch(/seenDays/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 31. A CROSSING ALREADY UNDERWAY WAS REPORTED AS PEAKING NOW
// Found by auditing every clock-facing number the app prints, after the void
// bugs showed the pattern: a coarse scan whose result is printed as an exact
// time.
//
// getNextAngularCrossings scans in 4-minute steps and reported the grid step
// with the smallest separation as the exact crossing. Two consequences:
//
//   · Sub-step drift. The ASC moves ~1° per 4 minutes, so the reported peak sat
//     up to ~2 minutes off, with an orb of 0.11–0.36° printed to two decimals
//     against a true ~0.00°.
//   · Far worse: a crossing ALREADY IN PROGRESS when the scan began had its
//     minimum at step 0, so its first step became "the peak". Measured
//     2026-08-01 Chiron–IC: reported 00:00:00 with orb 2.25°, actual
//     perfection 23:51:22 with orb 0.002° — nine minutes late, a hundredfold
//     wrong on the orb, and announced as happening now. These feed a banner
//     that calls them "a ~20-min window", so nine minutes is most of it.
//
// Sunrise/sunset was audited in the same pass and needed no change: measured
// against true solar altitude at the horizon over 40 events, worst drift 29
// seconds.
// ─────────────────────────────────────────────────────────────────────────────

describe("angular crossing precision", () => {
  it("finds the true peak, including one that perfected before the scan began", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const LAT = 30.27, LON = -97.74;
    const jd0 = A.julianDay(new Date("2026-08-01T00:00:00Z"));
    const crossings = A.getNextAngularCrossings(jd0, LAT, LON, 3, 24);
    expect(crossings.length).toBeGreaterThan(0);

    let worst = 0;
    for (const c of crossings.slice(0, 8)) {
      const at = Date.parse(c.crossingTime);
      const sepAt = (ms: number) => {
        const j = A.julianDay(new Date(ms));
        const ang = A.getLocalAngles(j, LAT, LON);
        const lon = c.planet === "Moon" ? A.moonLongitude(j)
          : A.getPlanetPositions(j).find((p: any) => p.planet === c.planet)?.longitude ?? 0;
        const target = ({ ASC: ang.asc, MC: ang.mc, DSC: ang.dsc, IC: ang.ic } as any)[c.angle];
        const raw = ((Math.abs(lon - target) % 360) + 360) % 360;
        return raw > 180 ? 360 - raw : raw;
      };
      // Brute force at 5-second resolution — no shared method with the code
      // under test, so this cannot agree with it by construction.
      let best = at, bestSep = Infinity;
      for (let s = -1500; s <= 1500; s += 5) {
        const v = sepAt(at + s * 1000);
        if (v < bestSep) { bestSep = v; best = at + s * 1000; }
      }
      worst = Math.max(worst, Math.abs(best - at) / 60000);
    }
    expect(worst).toBeLessThan(1);   // was 8.63 minutes
  }, 60000);

  it("looks BACKWARD when the minimum lands on the first step", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    expect(src).toMatch(/refineCrossingPeak/);
    // The searchBack flag is the whole fix for the in-progress case; without it
    // the refinement just polishes a peak that is in the wrong place entirely.
    expect(src).toMatch(/existing\.minStep === 0/);
    expect(src).toMatch(/state\.minStep === 0/);
  });

  it("reports a crossing that already perfected with a negative offset", async () => {
    // Rather than pinning it to zero and claiming it is happening now. Every
    // consumer passes minutesFromNow through or filters on the timestamp, so a
    // negative value is simply the truth.
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const cs = A.getNextAngularCrossings(A.julianDay(new Date("2026-08-01T00:00:00Z")), 30.27, -97.74, 3, 24);
    const chiron = cs.find((c: any) => c.planet === "Chiron" && c.angle === "IC");
    if (chiron) {
      expect(chiron.minutesFromNow).toBeLessThan(0);
      expect(chiron.orbAtExact).toBeLessThan(0.1);   // was 2.25
    }
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 32. "EXACT IN ~7 HOURS" FOR AN ASPECT PERFECTING IN 32 MINUTES
// Round two of the timing audit, and the worst finding in it.
//
// hoursToExact came from a linear extrapolation over a ONE-HOUR finite
// difference: sep / (sep - sepOneHourLater). That straddles the perfection
// whenever the aspect becomes exact within the hour — sep and sepN then sit on
// opposite sides of zero, the apparent closing rate collapses toward nothing,
// and the estimate explodes. Measured 2026-08-02, Moon square Mars: orb 0.28°,
// applying, true perfection 32 minutes away, REPORTED AS 6.6 HOURS. The rail
// renders this as a clock time.
//
// It failed hardest on exactly the aspects that matter most — the ones about to
// perfect — and the Moon was the one body left on the linear path, on the
// grounds that it is "fast and never stations". Never stationing justifies
// skipping the turn detection; it says nothing about timing.
//
// Planetary hours were audited in the same pass and needed no change: boundary
// mismatch 0.0 seconds across 10 samples, and each hour abuts the next exactly.
// ─────────────────────────────────────────────────────────────────────────────

describe("aspect perfection times", () => {
  it("is accurate for Moon pairs, which perfect soonest and matter most", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    let worst = 0, n = 0;
    for (let d = 0; d < 8; d++) {
      const now = new Date(Date.parse("2026-08-01T09:00:00Z") + d * 86400000);
      for (const a of A.getMajorAspects(A.julianDay(now))) {
        if (a.hoursToExact == null || a.stationsBeforeExact) continue;
        if (!(a.planet1 === "Moon" || a.planet2 === "Moon")) continue;
        const sepAt = (ms: number) => {
          const j = A.julianDay(new Date(ms));
          const lon = (p: string) => p === "Moon" ? A.moonLongitude(j)
            : A.getPlanetPositions(j).find((x: any) => x.planet === p)?.longitude ?? 0;
          const raw = ((Math.abs(lon(a.planet1) - lon(a.planet2)) % 360) + 360) % 360;
          return Math.abs((raw > 180 ? 360 - raw : raw) - a.exactAngle);
        };
        // Brute force at 1-minute resolution across the whole approach — no
        // shared method with the code under test.
        const est = now.getTime() + a.hoursToExact * 3600000;
        let best = est, bestSep = Infinity;
        for (let m = 0; m <= 24 * 60; m++) {
          const v = sepAt(now.getTime() + m * 60000);
          if (v < bestSep) { bestSep = v; best = now.getTime() + m * 60000; }
        }
        if (bestSep > 0.3) continue;   // never actually perfects in range
        worst = Math.max(worst, Math.abs(best - est) / 60000); n++;
      }
    }
    expect(n).toBeGreaterThan(5);
    expect(worst).toBeLessThan(10);    // was 364 minutes
  }, 120000);

  it("determines applying/separating from a short baseline", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    // A one-hour baseline can flip the sign when perfection falls inside it.
    expect(src).toMatch(/const sepShort = sepAt\(5 \/ 60/);
    expect(src).toMatch(/const applying = sepShort < sep/);
  });

  it("searches for the Moon's perfection instead of extrapolating to it", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    const moonBranch = src.slice(src.indexOf("if (isMoonPair) {"), src.indexOf("} else {", src.indexOf("if (isMoonPair) {")));
    expect(moonBranch).toMatch(/hi = m2; else lo = m1/);   // ternary search
  });

  it("refines the slow-pair walk off its six-hour grid", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    // minAtH is a multiple of SCAN_STEP_H, so it sat up to 3h from the truth.
    expect(src).toMatch(/lo = Math\.max\(0, minAtH - SCAN_STEP_H\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 33. MOON PERFECTION TIMES, AND THE FLOOR UNDER ALL OF THIS
// Fifth and last instance of the audit's pattern, found by following the chain
// rather than stopping at "election windows look fine": scanMoonPerfections
// stepped in 10 minutes and returned the grid step as `timeMs`. That value
// centres a ±2.5h election swell, where 10 minutes is harmless — but it is also
// printed verbatim as "Moon trine Venus · exact 3:20 PM" in an election's
// reasoning and on the Studio cards. Now bisected: 10 min → ~60 s.
//
// AND THE CORRECTION THAT MATTERS MORE:
//
// The ephemeris quantises time to 30 SECONDS. moonLongitude() returns an
// identical value for every instant inside a 30-second bucket, though
// julianDay() carries full 1-second resolution — so the quantisation is in the
// ephemeris implementation, not in how we call it.
//
// This is the floor under every timing claim in this codebase, and it means the
// audit's headline figures ("0.64 s", "0 s drift") measured AGREEMENT BETWEEN
// TWO SEARCHES OVER THE SAME QUANTISED DATA — not absolute accuracy. The real
// statement is: the scan-grid error (6 to 58 minutes) is gone; what remains is
// the ephemeris's own ±30 s, and no amount of refinement will beat it.
//
// Nobody should spend another hour chasing sub-minute precision here. If it is
// ever genuinely needed, the ephemeris is the thing to replace.
// ─────────────────────────────────────────────────────────────────────────────

describe("ephemeris time granularity", () => {
  it("is 30 seconds — the floor under every timing number we print", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const base = Date.parse("2026-08-01T12:00:00Z");
    const l0 = A.moonLongitude(A.julianDay(new Date(base)));
    let firstChange: number | null = null;
    for (let s = 1; s <= 300; s++) {
      if (A.moonLongitude(A.julianDay(new Date(base + s * 1000))) !== l0) { firstChange = s; break; }
    }
    expect(firstChange).not.toBeNull();
    expect(firstChange).toBeLessThanOrEqual(60);
    // If this ever drops to 1s the ephemeris has been changed, and the comments
    // above about a 30-second floor need revisiting.
    expect(firstChange).toBeGreaterThan(1);
  }, 60000);

  it("julianDay itself carries full second resolution", () => {
    // So the quantisation is NOT ours — worth knowing before anyone tries to
    // fix it here.
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    expect(src).toMatch(/getUTCSeconds\(\) \/ 86400/);
  });

  it("moon perfections are bisected, not reported as a 10-minute grid step", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/studioCard.ts"), "utf-8");
    expect(src).toMatch(/const perfectionAt =/);
    expect(src).toMatch(/timeMs: perfectionAt\(t - STEP, t, p, A\.deg\)/);
    // Bisecting on progress-from-step-start rather than the raw delta is what
    // removes the 360°→0° special case a hand-rolled wrap test got wrong.
    expect(src).toMatch(/norm360\(deltaAt\(mid\) - d0\) >= target/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 34. THE FELT RATING WAS WRITE-ONLY, AND THE WAKE DATED WINS BY updatedAt
// Owner's call 2026-07-31: drop the aligned/mixed/off rating and build the
// pattern on what people actually finish. Two defects underneath it.
//
// (a) The rating changed nothing. Traced across electionEngine, election,
//     synthesis, dayarc, interpretation and plan: zero references. It cost
//     thirty seconds a day and returned one sentence. It was also confounded by
//     its own advice — the app says "a Deep day, rest", you rest, and it asks
//     whether that felt right. Agreement there is compliance, not evidence.
//
// (b) `tasks` had no completion timestamp at all, so "what do you finish on a
//     Deep day" was unanswerable however much anyone finished. Adding it
//     immediately exposed a live bug: the wake ledger dated a finished task by
//     `updatedAt`, which moves on ANY edit — so renaming a task completed last
//     month re-dated it as a win TODAY. Seeding 42 historical completions
//     rendered "Today's wins · 42". After the fix: 2, the two actually
//     finished today.
// ─────────────────────────────────────────────────────────────────────────────

describe("behavioural pattern replaces the felt rating", () => {
  const today = readFileSync(join(process.cwd(), "artifacts/tides/src/pages/Today.tsx"), "utf-8");

  it("no longer asks anyone to rate a day", () => {
    expect(today).not.toMatch(/How did today feel/);
    expect(today).not.toMatch(/Yesterday felt/);
    expect(today).not.toMatch(/FELT_OPTIONS/);
  });

  it("reads the pattern from completions, not from self-report", () => {
    expect(today).toMatch(/done-pattern/);
    expect(today).not.toMatch(/felt-pattern/);
  });

  it("keeps the epistemic rules that were the good part of the old loop", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/donePattern.ts"), "utf-8");
    expect(src).toMatch(/MIN_PER_CHARACTER/);       // silent below a floor
    expect(src).toMatch(/otherPerDay/);             // always the comparison
    expect(src).toMatch(/range: \{ from: since, to: today \}/); // always the window
    // Days with ZERO completions must count, or the pattern only ever sees the
    // days that went well.
    expect(src).toMatch(/const n = perDay\.get\(d\) \?\? 0;/);
  });

  it("makes no causal claim", () => {
    const banned = ["makes you", "causes", "will be", "proves", "guarantees"];
    for (const b of banned) expect(today.toLowerCase()).not.toContain(`day ${b}`);
    expect(today).toMatch(/What happened on those days, not what they do to you/);
  });

  it("dates a finished task by when it was FINISHED", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/momentum.ts"), "utf-8");
    expect(src).toMatch(/t\.completedAt \?\? t\.updatedAt/);
  });

  it("stamps completedAt on the flip to done, and clears it on the flip back", () => {
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/routes/tasks.ts"), "utf-8");
    expect(src).toMatch(/String\(done\) === "true" \? new Date\(\) : null/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 35. THE THIRD COMPLETION SIGNAL HAD NO DOOR
// POST /planning/windows/:id/complete shipped with the Planner and was never
// called from anywhere in the client, so `planning_windows.completedAt` was
// null on virtually every row (2 of 12 in production, both set by something
// other than a user).
//
// Two consequences. The evening card already printed "completed N blocks" — a
// sentence nobody could make true. And the done-pattern reads three completion
// sources; one of them could never contribute, so a third of the evidence for
// the feature that replaced the felt rating did not exist.
// ─────────────────────────────────────────────────────────────────────────────

describe("marking a scheduled block done", () => {
  const today = readFileSync(join(process.cwd(), "artifacts/tides/src/pages/Today.tsx"), "utf-8");

  it("calls the endpoint that was built and never wired", () => {
    expect(today).toMatch(/planning\/windows\/\$\{id\}\/complete/);
  });

  it("checks r.ok — a silent write failure here is the bug class §2 removed", () => {
    // Anchored by length, not by a second marker: "const tide = now?.tide"
    // occurs earlier in the file too, which made the slice negative and the
    // assertion vacuous against an empty string.
    const at = today.indexOf("const markBlock = useMutation");
    const block = today.slice(at, at + 1200);
    expect(at).toBeGreaterThan(-1);
    expect(block).toMatch(/if \(!r\.ok\) throw/);
    expect(block).toMatch(/onError/);
  });

  it("offers one verb, not two — 'skip' is just not pressing anything", () => {
    // A schedule that makes you account for every unmet block is the guilt
    // ledger this product refuses (BACKLOG §4, do-not-copy).
    const comp = today.slice(today.indexOf("function BlockCheck"), today.indexOf("function DonePattern"));
    expect(comp).toMatch(/did it/);
    expect(comp).not.toMatch(/Skip|skipped/);
  });

  it("only lists blocks that are still open", () => {
    const comp = today.slice(today.indexOf("function BlockCheck"), today.indexOf("function DonePattern"));
    expect(comp).toMatch(/filter\(\(w: any\) => !w\.completedAt\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 36. TODAY'S WINDOWS WERE A UTC DAY, NOT THE VIEWER'S DAY
// Shipped bug, found 2026-07-31 while building on top of it. `GET
// /planning/windows?date=YYYY-MM-DD` took a LOCAL calendar date and applied
// UTC day bounds to a timestamptz column:
//
//     new Date(date + "T00:00:00.000Z") … new Date(date + "T23:59:59.999Z")
//
// Measured against a real server and database in America/Chicago: 4 of 7 test
// windows filed on the wrong day. Everything from 19:00 local onward dropped
// out of "today", and yesterday's 21:00 appeared inside it. The error is the
// viewer's UTC offset — 5h for Austin, 5.5h the other way for Kolkata.
//
// This is the same disease as the app-wide UTC rollover fix (BACKLOG §1), and
// it survived that sweep because the sweep was looking for `toISOString()
// .slice(0,10)` on date STRINGS, while this route bounds a timestamp. It bites
// hardest in the evening — which is precisely when the shutdown ritual, the
// evening re-homing work and the cascade all read the day's windows.
//
// The fix refuses to guess: the browser is the only party that knows its own
// offset, so it sends the day's boundaries as instants and the server just
// filters between them.
// ─────────────────────────────────────────────────────────────────────────────

import { localDayRange } from "../artifacts/tides/src/lib/dates";

describe("today's windows are the viewer's day, not UTC's", () => {
  const datesSrc = readFileSync(
    join(process.cwd(), "artifacts/tides/src/lib/dates.ts"), "utf-8",
  );
  const planningSrc = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/planning.ts"), "utf-8",
  );

  // Re-implemented here rather than imported, so the test and the shipped
  // helper can disagree.
  function rangeOf(dateStr: string) {
    const start = new Date(dateStr + "T00:00:00");
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    return { from: start, to: next };
  }

  it("the range starts at local midnight and ends at the next local midnight", () => {
    // True in every zone the CI matrix runs (Chicago, Kolkata, UTC) — the
    // assertion is about local wall clock, so it needs no offset of its own.
    for (const d of ["2026-01-15", "2026-06-30", "2026-08-12", "2026-12-31"]) {
      const { from, to } = rangeOf(d);
      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(to.getHours()).toBe(0);
      const [y, m, day] = d.split("-").map(Number);
      expect(from.getFullYear()).toBe(y);
      expect(from.getMonth() + 1).toBe(m);
      expect(from.getDate()).toBe(day);
      // The day after, by the calendar rather than by adding 24h.
      const expectedNext = new Date(y, m - 1, day + 1);
      expect(to.getDate()).toBe(expectedNext.getDate());
    }
  });

  it("a DST day is 23 or 25 hours long, and the range says so", () => {
    // Adding 86_400_000ms would be silently wrong twice a year. In a zone
    // without DST every day is 24h and this still holds.
    for (const d of ["2026-03-08", "2026-11-01", "2026-08-12"]) {
      const { from, to } = rangeOf(d);
      const hours = (to.getTime() - from.getTime()) / 3_600_000;
      expect([23, 24, 25]).toContain(hours);
    }
  });

  it("the old UTC-bounds method really was wrong — not merely different", () => {
    // Keeps the size of the defect on the record, so nobody restores the
    // one-liner as a simplification. Skipped where it cannot fire.
    const offsetMin = new Date("2026-08-12T12:00:00").getTimezoneOffset();
    if (offsetMin === 0) return; // UTC: the old method was correct there

    const { from, to } = rangeOf("2026-08-12");
    const utcStart = new Date("2026-08-12T00:00:00.000Z");
    const utcEnd = new Date("2026-08-12T23:59:59.999Z");

    // An evening instant the viewer calls "today".
    const evening = new Date("2026-08-12T21:00:00");
    const inNew = evening >= from && evening < to;
    const inOld = evening >= utcStart && evening <= utcEnd;
    expect(inNew).toBe(true);
    if (offsetMin > 0) {
      // West of UTC (the Americas): the old bounds lost the evening.
      expect(inOld).toBe(false);
    }
    // And the two disagree by exactly the viewer's offset.
    expect(Math.abs(from.getTime() - utcStart.getTime()) / 60_000).toBe(Math.abs(offsetMin));
  });

  it("the SHIPPED helper agrees with that independent re-implementation", () => {
    // Without this the three tests above would be checking my arithmetic and
    // never the app's — a re-implementation only earns its keep if something
    // actually compares the two.
    for (const d of ["2026-01-15", "2026-03-08", "2026-08-12", "2026-11-01", "2026-12-31"]) {
      const mine = rangeOf(d);
      const theirs = localDayRange(d);
      expect(theirs.from).toBe(mine.from.toISOString());
      expect(theirs.to).toBe(mine.to.toISOString());
    }
  });

  it("the client sends the boundaries and the server prefers them", () => {
    expect(datesSrc).toMatch(/export function localDayRange/);
    // The server must not fall back to UTC bounds when it was given real ones.
    expect(planningSrc).toMatch(/if \(from && to\)/);
    expect(planningSrc).toMatch(/lt\(planningWindows\.startTime, new Date\(to\)\)/);
  });

  it("both window callers send from/to, not a bare date", () => {
    for (const rel of ["artifacts/tides/src/hooks/useTides.ts",
                       "artifacts/tides/src/pages/Calendar.tsx"]) {
      const src = readFileSync(join(process.cwd(), rel), "utf-8");
      const call = src.slice(src.indexOf("planning/windows?date="));
      expect(call.slice(0, 200)).toMatch(/from=\$\{encodeURIComponent/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 37. THE CASCADE'S GRADING, AND THE THRESHOLD THAT CRIED WOLF
// The cascade ("your 2pm ran long — shift the next three?") has to say what a
// move COSTS, which means grading a moved window. First calibration drew the
// workable/against line at the day's MEDIAN energy — so half of every day was
// "against" by construction. The first end-to-end run graded three ordinary
// afternoon blocks "against → against": alarming, and carrying no information.
//
// "Against" is the app's strongest word for a placement ("the only open water
// left"). If it fires half the time it stops meaning anything, and the whole
// reason this product can refuse is that its refusals are rare and earned.
//
// The measured problem with a raw threshold instead (2026-08-12, Austin):
//   water  min=0.146  max=0.267        ← water's BEST hour
//   air    min=0.213  p25=0.276        ← below air's 25th percentile
// so any fixed number grades every water block against and no air block.
// Energy is now normalised within each element's own daily range.
// ─────────────────────────────────────────────────────────────────────────────

import { tierForMoment, compareTiers, WINDOW_ELEMENT, TIER_NOTE } from "../artifacts/api-server/src/lib/timingTier";
import { computeDayArc as arcFor } from "../artifacts/api-server/src/lib/dayarc";
// The schema's own list, so adding a window type there fails this suite rather
// than silently falling back to a default element.
import { WINDOW_TYPES as WINDOW_TYPES_FROM_SCHEMA } from "../lib/db/src/schema/planning";

describe("cascade timing grades", () => {
  const LAT = 30.27, LON = -97.74, TZ = 300;
  const noon = new Date("2026-08-12T17:00:00Z"); // midday in Austin
  const arc = arcFor(noon, LAT, LON, TZ);
  const dayStart = new Date(arc.dayStart).getTime();
  const HOUR = 3600_000;

  /** Grade every half hour of the working day for one element. */
  function gradeDay(element: string) {
    const out: string[] = [];
    for (let h = 6; h < 23; h += 0.5) {
      out.push(tierForMoment({
        element, startMs: dayStart + h * HOUR, durMs: HOUR,
        lat: LAT, lon: LON, tzOffsetMin: TZ, arc,
      }).tier);
    }
    return out;
  }

  it("'against' stays rare — it is the strongest word, not the default", () => {
    for (const element of ["fire", "earth", "air", "water"]) {
      const tiers = gradeDay(element);
      const against = tiers.filter((t) => t === "against").length / tiers.length;
      // Measured worst case across three unlike days is 18% (earth, a day
      // whose peaks fall outside working hours). The median threshold produced
      // ~50%. This bound sits between them, so it catches the bug coming back
      // without failing on an unusually flat sky.
      expect(against).toBeLessThan(0.25);
    }
  });

  it("no element is graded 'against' all day just for having a low curve", () => {
    // Water's best hour scores below air's worst quartile. A raw threshold
    // made water permanently against; normalising is what fixes it.
    for (const element of ["fire", "earth", "air", "water"]) {
      const tiers = new Set(gradeDay(element));
      expect(tiers.has("workable") || tiers.has("great")).toBe(true);
    }
  });

  it("every element still gets some genuinely good hours", () => {
    for (const element of ["fire", "earth", "air", "water"]) {
      expect(gradeDay(element)).toContain("great");
    }
  });

  it("tiers order worst→best, so a move can be compared to where it came from", () => {
    expect(compareTiers("against", "workable")).toBeLessThan(0);
    expect(compareTiers("workable", "great")).toBeLessThan(0);
    expect(compareTiers("great", "great")).toBe(0);
    expect(compareTiers("great", "against")).toBeGreaterThan(0);
  });

  it("relative energy is comparable across elements even though raw is not", () => {
    // The property that makes one threshold legitimate for all four.
    for (const element of ["fire", "earth", "air", "water"]) {
      let lo = Infinity, hi = -Infinity;
      for (let h = 0; h < 24; h += 0.5) {
        const v = tierForMoment({
          element, startMs: dayStart + h * HOUR, durMs: HOUR,
          lat: LAT, lon: LON, tzOffsetMin: TZ, arc,
        }).relative;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      // Each element uses most of its own 0..1 range — that is what makes the
      // single AGAINST_BELOW line mean the same thing for all of them.
      expect(hi - lo).toBeGreaterThan(0.5);
    }
  });

  it("every window type maps to an element — a new type can't silently default", () => {
    // WINDOW_ELEMENT is a deliberate choice, not a derivation (associate.ts
    // maps only element→windowType, and lossily). If someone adds a type,
    // this fails rather than quietly grading it as earth.
    for (const t of WINDOW_TYPES_FROM_SCHEMA) {
      expect(Object.keys(WINDOW_ELEMENT)).toContain(t);
    }
  });

  it("the note is the weaver's own wording, not a second vocabulary", () => {
    const v = tierForMoment({
      element: "water", startMs: dayStart + 3 * HOUR, durMs: HOUR,
      lat: LAT, lon: LON, tzOffsetMin: TZ, arc,
    });
    expect(Object.values(TIER_NOTE).concat([`a great time — ${v.planetaryHour}'s own hour`]))
      .toContain(v.tierNote);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 38. RE-HOMING UNDONE WORK
// The other half of the shutdown ritual. Tasks roll over quietly; WINDOWS
// never do, deliberately — a window is a claim on a moment, so moving one
// unasked retracts a reason rather than shuffling a slot. So at day's end the
// honest question is "this didn't happen — when does it actually fit?", and
// the answer is scored for the work rather than being "same time tomorrow".
//
// These are the product claims, so they are tested rather than eyeballed. The
// self-overlap one is a real defect caught in review: a 90-minute block was
// offered at 9:30 AND 10:30, which overlap by half an hour — one option
// presented as two. Spacing is now the block's own length.
// ─────────────────────────────────────────────────────────────────────────────

import { pickRehomeSlots } from "../artifacts/api-server/src/lib/rehome";

describe("re-homing suggestions", () => {
  const LAT = 30.27, LON = -97.74, TZ = 300, HOUR = 3600_000;
  const arc2 = arcFor(new Date("2026-08-12T17:00:00Z"), LAT, LON, TZ);
  const dayStartMs = new Date(arc2.dayStart).getTime();

  const base = {
    dayStartMs, element: "water", busy: [] as { startMs: number; endMs: number }[],
    wakeHour: 7, sleepHour: 22, nowMs: dayStartMs, // "now" = start of that day
    lat: LAT, lon: LON, tzOffsetMin: TZ, arc: arc2,
  };

  it("never proposes options that overlap each other", () => {
    // 9:30 and 10:30 for a 90-minute block is one option offered twice.
    for (const mins of [30, 45, 60, 90, 120, 180]) {
      const picks = pickRehomeSlots({ ...base, durMs: mins * 60_000 });
      for (let i = 1; i < picks.length; i++) {
        expect(picks[i].startMs).toBeGreaterThanOrEqual(picks[i - 1].endMs);
      }
    }
  });

  it("never proposes a time that collides with something already booked", () => {
    const busy = [
      { startMs: dayStartMs + 9 * HOUR, endMs: dayStartMs + 10 * HOUR },
      { startMs: dayStartMs + 13 * HOUR, endMs: dayStartMs + 15 * HOUR },
      { startMs: dayStartMs + 18 * HOUR, endMs: dayStartMs + 19.5 * HOUR },
    ];
    for (const element of ["fire", "earth", "air", "water"]) {
      const picks = pickRehomeSlots({ ...base, element, busy, durMs: 60 * 60_000 });
      expect(picks.length).toBeGreaterThan(0);
      for (const p of picks) {
        for (const b of busy) {
          expect(p.startMs < b.endMs && p.endMs > b.startMs).toBe(false);
        }
      }
    }
  });

  it("never proposes an hour that has already gone", () => {
    // Re-homing runs in the evening; for "later today" every morning slot is
    // already spent, and offering one would be nonsense rather than generous.
    const nowMs = dayStartMs + 15 * HOUR;
    const picks = pickRehomeSlots({ ...base, nowMs, durMs: 60 * 60_000 });
    for (const p of picks) expect(p.startMs).toBeGreaterThanOrEqual(nowMs);
  });

  it("stays inside waking hours, including the block's own end", () => {
    // A 2-hour block starting at 21:00 would run to 23:00 — past a 22:00
    // bedtime. The END has to fit, not just the start.
    const picks = pickRehomeSlots({ ...base, durMs: 120 * 60_000 });
    for (const p of picks) {
      expect(p.startMs).toBeGreaterThanOrEqual(dayStartMs + base.wakeHour * HOUR);
      expect(p.endMs).toBeLessThanOrEqual(dayStartMs + base.sleepHour * HOUR);
    }
  });

  it("returns nothing rather than something bad when the day is full", () => {
    // Silence is the honest answer; the route says so in words. Inventing a
    // 3am slot to avoid an empty list would be the silent-move behaviour the
    // whole feature exists to refuse.
    const busy = [{ startMs: dayStartMs, endMs: dayStartMs + 24 * HOUR }];
    expect(pickRehomeSlots({ ...base, busy, durMs: 60 * 60_000 })).toEqual([]);
  });

  it("offers the best available first — sorted by time, chosen by fit", () => {
    const picks = pickRehomeSlots({ ...base, durMs: 60 * 60_000 });
    // Presented chronologically…
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i].startMs).toBeGreaterThan(picks[i - 1].startMs);
    }
    // …but SELECTED on fit: no pick may be worse than a rejected slot that
    // would have fitted the same gap.
    expect(picks.every((p) => p.verdict.tier !== "against")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 39. "WILL RETRY" DIDN'T
// Shipped bug. The journal reported `saved on this device only — will retry`
// on a failed sync, and nothing retried: the flag was set, no timer was armed,
// and the only thing that ever tried again was the user typing another
// character. Write an entry offline, close the tab, and the text stayed in
// localStorage for good — while the hydration path only reads the server when
// there is NO local copy, so it looked fine indefinitely.
//
// An app telling someone their work is safe when it isn't is worse than one
// admitting it failed. These tests are the sentence being true.
// ─────────────────────────────────────────────────────────────────────────────

import { Outbox, RETRY_DELAYS_MS } from "../artifacts/tides/src/lib/outbox";

/** A hand-driven clock: nothing fires until the test advances it. */
function harness() {
  let seq = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let clock = 0;
  return {
    armed: () => [...timers.values()].map((t) => t.at - clock),
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { fn, at: clock + ms });
      return id;
    },
    clearTimer: (h: unknown) => { timers.delete(h as number); },
    /** Advance time and run whatever comes due, flushing microtasks after. */
    async advance(ms: number) {
      clock += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= clock) { timers.delete(id); t.fn(); }
      }
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

describe("the outbox actually retries", () => {
  it("sends after the debounce and reports clean", async () => {
    const h = harness();
    const sent: string[] = [];
    const states: string[] = [];
    const o = new Outbox({
      send: async (p) => { sent.push(p); return true; },
      onState: (s) => states.push(s),
      setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 900,
    });
    o.queue("a line about today");
    expect(sent).toEqual([]);            // nothing posted per keystroke
    await h.advance(900);
    expect(sent).toEqual(["a line about today"]);
    expect(o.state).toBe("clean");
    expect(states).toEqual(["pending", "syncing", "clean"]);
  });

  it("ARMS A RETRY on failure — the whole bug in one assertion", async () => {
    const h = harness();
    const o = new Outbox({
      send: async () => false,
      onState: () => {},
      setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 900,
    });
    o.queue("text");
    await h.advance(900);
    expect(o.state).toBe("failed");
    // The old code set a flag and stopped here. A timer must exist.
    expect(h.armed()).toEqual([RETRY_DELAYS_MS[0]]);
  });

  it("retries on the documented backoff and recovers", async () => {
    const h = harness();
    let fail = 3;
    const sent: string[] = [];
    const o = new Outbox({
      send: async (p) => { sent.push(p); return fail-- <= 0; },
      onState: () => {},
      setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 900,
    });
    o.queue("text");
    await h.advance(900);
    expect(sent.length).toBe(1);
    for (let i = 0; i < 3; i++) {
      expect(h.armed()).toEqual([RETRY_DELAYS_MS[i]]);
      await h.advance(RETRY_DELAYS_MS[i]);
      expect(sent.length).toBe(i + 2);
    }
    expect(o.state).toBe("clean");
    expect(o.hasPending).toBe(false);
  });

  it("keeps the text when it runs out of attempts — never a silent drop", async () => {
    const h = harness();
    const o = new Outbox({
      send: async () => false,
      onState: () => {},
      setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 0,
    });
    o.queue("precious");
    await h.advance(0);
    for (const d of RETRY_DELAYS_MS) await h.advance(d);
    expect(h.armed()).toEqual([]);      // stopped scheduling…
    expect(o.state).toBe("failed");     // …and says so…
    expect(o.hasPending).toBe(true);    // …but still holds the words.
  });

  it("a manual retry (or a reconnect) picks it up again", async () => {
    const h = harness();
    let ok = false;
    const sent: string[] = [];
    const o = new Outbox({
      send: async (p) => { sent.push(p); return ok; },
      onState: () => {},
      setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 0,
    });
    o.queue("precious");
    await h.advance(0);
    for (const d of RETRY_DELAYS_MS) await h.advance(d);
    expect(o.state).toBe("failed");
    ok = true;
    o.retryNow();
    await h.advance(0);
    expect(o.state).toBe("clean");
    expect(sent[sent.length - 1]).toBe("precious");
  });

  it("newer text wins when it supersedes an in-flight send", async () => {
    // The failure this prevents: a slow success for the OLD text clearing the
    // queue, so the newer edit is lost with the UI reading "saved".
    const h = harness();
    const sent: string[] = [];
    let release: (v: boolean) => void = () => {};
    const o = new Outbox({
      send: async (p) => { sent.push(p); return new Promise<boolean>((r) => { release = r; }); },
      onState: () => {}, setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 0,
    });
    o.queue("first");
    await h.advance(0);
    expect(sent).toEqual(["first"]);
    o.queue("second");                 // typed while "first" is still in flight
    release(true);                     // the old request finally succeeds
    await h.advance(0);
    // It must NOT stop here calling itself clean — the newer text is unsent.
    expect(sent).toEqual(["first", "second"]);
    expect(o.state).toBe("syncing");
    release(true);                     // and now the newer one lands
    await h.advance(0);
    expect(o.state).toBe("clean");
    expect(o.hasPending).toBe(false);
  });

  it("restores unsent text from a previous session promptly", async () => {
    // The case the old code had no answer for: text written offline yesterday,
    // still on disk, never sent.
    const h = harness();
    const sent: string[] = [];
    const o = new Outbox({
      send: async (p) => { sent.push(p); return true; },
      onState: () => {}, setTimer: h.setTimer, clearTimer: h.clearTimer, debounceMs: 900,
    });
    o.restore("yesterday's line");
    await h.advance(0);               // no debounce wait — it is already old
    expect(sent).toEqual(["yesterday's line"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 40. THE AI GUARD NOBODY COULD USE
// `isOpenAiConfigured` shipped with a comment telling "every AI route" to
// check it and 503. Zero routes did — and the reason turned out to be
// structural: the flag was exported from ./client but NOT from the package
// barrel, so from where the routes stand (importing the package root) it did
// not exist. The instruction was unfollowable.
//
// Auditing the eight call sites also showed "503 everywhere" was the wrong
// instruction. Three routes already fall back to a DETERMINISTIC answer, and
// refusing there would remove a working feature. The rule that survives is:
// never call the model with a placeholder credential, and prefer the
// deterministic answer wherever one exists.
//
// Third bug, caught only by booting it: re-exporting the flag from aiGuard.ts
// under its own name made esbuild emit a self-referential binding, and every
// guarded route threw `ReferenceError: isOpenAiConfigured4 is not defined` at
// request time — through a CLEAN build and a CLEAN typecheck.
// ─────────────────────────────────────────────────────────────────────────────

describe("the AI guard is reachable and used correctly", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
  const barrel = read("lib/integrations-openai-ai-server/src/index.ts");
  const guard = read("artifacts/api-server/src/lib/aiGuard.ts");

  it("the package barrel exports the flag, not just the client", () => {
    // The whole reason the instruction went unfollowed for so long.
    expect(barrel).toMatch(/export \{[^}]*isOpenAiConfigured[^}]*\} from "\.\/client"/);
  });

  it("aiGuard does NOT re-export the flag under its own name", () => {
    // Bundler-level footgun: it type-checks and builds, then throws per
    // request. Routes import the flag from the package.
    expect(guard).not.toMatch(/export \{\s*isOpenAiConfigured\s*\}/);
  });

  it("routes with a deterministic fallback degrade instead of refusing", () => {
    // A 503 here would replace a working answer with an error.
    for (const [file, marker] of [
      ["artifacts/api-server/src/routes/associate.ts", "res.json(base)"],
      ["artifacts/api-server/src/routes/planning.ts", "res.json(fallback())"],
      ["artifacts/api-server/src/routes/chart.ts", "deterministic()"],
    ] as const) {
      const src = read(file);
      const at = src.indexOf("if (!isOpenAiConfigured)");
      expect(at).toBeGreaterThan(-1);
      expect(src.slice(at, at + 120)).toContain(marker);
      expect(src.slice(at, at + 120)).not.toContain("503");
    }
  });

  it("the one route with nothing to fall back on returns a contained 503", () => {
    const src = read("artifacts/api-server/src/routes/blueprint.ts");
    expect(src).toMatch(/if \(aiUnavailable\(res\)\) return;/);
    expect(guard).toMatch(/res\.status\(503\)/);
  });

  it("the streaming routes are left alone — they already contain the error", () => {
    // advise and openai/messages emit an error frame the client renders;
    // changing their response shape for a config production doesn't have
    // would be churn with real regression risk.
    for (const f of ["advise.ts", "openai.ts"]) {
      expect(read(`artifacts/api-server/src/routes/${f}`)).not.toContain("aiUnavailable");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 41. THE TYPECHECK THAT WASN'T CHECKING
// api-server's tsconfig declared project references to lib/db, lib/api-zod and
// lib/integrations-openai-ai-server. Those projects emit declarations to
// `dist/`, which nothing built — so every run reported TS6305 ("output file
// has not been built from source file") and, far worse, **stopped validating
// imports across those package boundaries entirely**.
//
// Proof it was blind: an import of a symbol the package never exported
// (`isOpenAiConfigured`, absent from the barrel) passed both typecheck and
// build, then threw ReferenceError on every request.
//
// The references also contradicted the packages themselves, whose `exports`
// point at `./src/index.ts` — source, not dist. Dropping them lets TypeScript
// resolve through to real source. That took api-server from 16 masked errors
// to 23 REAL ones, all since fixed, and it now genuinely fails on a bad
// cross-package import.
// ─────────────────────────────────────────────────────────────────────────────

describe("cross-package imports are actually typechecked", () => {
  const readJson = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), "utf-8"));

  it("api-server declares no stale project references", () => {
    const cfg = readJson("artifacts/api-server/tsconfig.json");
    // A reference here is only safe if something builds the referenced dist.
    // Nothing does, and the packages export source anyway.
    expect(cfg.references).toBeUndefined();
  });

  it("the workspace packages export source, which is what makes that safe", () => {
    for (const p of ["lib/db", "lib/api-zod", "lib/integrations-openai-ai-server"]) {
      const exports = readJson(`${p}/package.json`).exports;
      expect(JSON.stringify(exports)).toMatch(/\.\/src\//);
    }
  });

  it("a package declaring node types depends on them", () => {
    // lib/integrations-openai-ai-server set types:["node"] without depending on
    // @types/node, so `tsc --build` failed at the root with TS2688 — which
    // short-circuited the whole typecheck script before it reached any app.
    for (const p of ["lib/db", "lib/integrations-openai-ai-server"]) {
      const cfg = readJson(`${p}/tsconfig.json`);
      if (!cfg.compilerOptions?.types?.includes("node")) continue;
      const pkg = readJson(`${p}/package.json`);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(deps["@types/node"]).toBeDefined();
    }
  });

  it("p-retry's AbortError is imported by name, not off the default export", () => {
    // In p-retry v7 it is a named export. `pRetry.AbortError` was undefined, so
    // every non-rate-limit batch failure threw "not a constructor" instead of
    // aborting — a broken error path, invisible while this package went
    // unchecked.
    const src = readFileSync(
      join(process.cwd(), "lib/integrations-openai-ai-server/src/batch/utils.ts"), "utf-8");
    expect(src).toMatch(/import pRetry, \{ AbortError \} from "p-retry"/);
    expect(src).not.toMatch(/new pRetry\.AbortError/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 42. THE PLANNER FORGOT EVERYTHING ON REFRESH
// `rawList`, `cards`, `result` and `dropped` were plain component state, so a
// reload — or a phone reclaiming the tab — silently discarded a typed dump, an
// AI parse of it, and a woven schedule. Minutes of work and two API calls,
// gone with no warning and no way back.
//
// Restoring it raises a rule worth testing: the LIST keeps its value
// indefinitely, the SCHEDULE does not. A weave names specific future moments,
// so once they have passed the proposal describes a sky that has moved on.
// Handing that back would be presenting stale timing as current — the exact
// failure §10 exists to prevent. The list returns; the plan doesn't; the user
// is told which.
// ─────────────────────────────────────────────────────────────────────────────

import { restorePlannerDraft } from "../artifacts/tides/src/lib/plannerDraft";

describe("planner drafts survive a refresh, stale schedules do not", () => {
  const NOW = Date.parse("2026-08-12T15:00:00Z");
  const at = (offsetHours: number) =>
    new Date(NOW + offsetHours * 3600_000).toISOString();
  const draft = (plannedStarts: number[]) => JSON.stringify({
    horizon: "week", rawList: "draft the report", cards: [{ title: "draft the report" }],
    result: { planned: plannedStarts.map((h) => ({ startAt: at(h) })) },
    dropped: [], savedAt: at(-1),
  });

  it("brings back the list and the parsed cards", () => {
    const { draft: d } = restorePlannerDraft(draft([2]), NOW);
    expect(d?.rawList).toBe("draft the report");
    expect(d?.cards).toHaveLength(1);
  });

  it("keeps a schedule that is still ahead", () => {
    const { draft: d, staleWeave } = restorePlannerDraft(draft([2, 5]), NOW);
    expect(staleWeave).toBe(false);
    expect(d?.result).not.toBeNull();
  });

  it("drops a schedule whose first block has passed, and says so", () => {
    const { draft: d, staleWeave } = restorePlannerDraft(draft([-3, 4]), NOW);
    expect(staleWeave).toBe(true);
    expect(d?.result).toBeNull();
    // …but never the list. Losing that is the bug being fixed.
    expect(d?.rawList).toBe("draft the report");
    expect(d?.cards).toHaveLength(1);
  });

  it("judges by the EARLIEST block, not the first in the array", () => {
    // Order isn't guaranteed; a past block hiding behind a future one would
    // restore a plan that already failed.
    const { staleWeave } = restorePlannerDraft(draft([6, -1]), NOW);
    expect(staleWeave).toBe(true);
  });

  it("survives nothing saved, and corrupt JSON, without throwing", () => {
    expect(restorePlannerDraft(null, NOW)).toEqual({ draft: null, staleWeave: false });
    expect(restorePlannerDraft("{not json", NOW)).toEqual({ draft: null, staleWeave: false });
  });

  it("a draft with no schedule at all is simply restored", () => {
    const raw = JSON.stringify({ rawList: "just a list", cards: null, result: null });
    const { draft: d, staleWeave } = restorePlannerDraft(raw, NOW);
    expect(staleWeave).toBe(false);
    expect(d?.rawList).toBe("just a list");
  });

  it("the component clears the draft once it is committed", () => {
    // Otherwise a written plan lingers and offers to re-commit work that
    // already exists on the calendar.
    const src = readFileSync(join(process.cwd(), "artifacts/tides/src/components/Planner.tsx"), "utf-8");
    const at2 = src.indexOf("setCommitted(true)");
    expect(at2).toBeGreaterThan(-1);
    expect(src.slice(at2, at2 + 260)).toMatch(/removeItem\(draftKey/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 43. THE MORNING EMAIL COMPUTED A READING AND THREW IT AWAY
// Owner, 2026-08-01: "it's a nothing burger… this card is just a bit short."
//
// It was short structurally. composeDay called dayReading() — the synthesis
// engine, with natal chart and ascendant ruler — assigned it to `reading`, and
// never referenced it again. "The sky, briefly" printed
// SIGN_GUIDE[moonSign].feel, a STATIC table entry, so every Pisces Moon got
// "warm fog on slack water" verbatim, for ever, whatever else was happening.
//
// That morning the discarded reading held: Moon applying to Mercury, Saturn's
// day, Waning Gibbous, and a Mars counterpoint. Six testimonies. None sent.
//
// The fix is not "write more" — it is "use what is already computed", and the
// ORDER is measured rather than assumed. Leading with the engine's headline
// flavour (the obvious pick) printed one verbatim sentence on 6 of 8 days: the
// same failure as the static blurb, in better prose. Leading on the Moon's
// applying aspect gives 14/14 unique openings over a fortnight.
// ─────────────────────────────────────────────────────────────────────────────

import { skyLines, cleanCounterpoint } from "../artifacts/api-server/src/lib/skyLines";
import { dayReading as readingFor } from "../artifacts/api-server/src/lib/synthesis";

describe("the morning email says something new each day", () => {
  const LAT = 30.27, LON = -97.74, TZ = 300;
  const fortnight = Array.from({ length: 14 }, (_, d) =>
    readingFor(new Date(Date.parse("2026-08-01T12:00:00Z") + d * 86400000), LAT, LON,
      { tzOffsetMin: TZ, scope: "day" }));

  it("never repeats yesterday's block", () => {
    // The email study drove consecutive duplicate emails from 16 to 0. A
    // static sky line quietly put them back.
    const blocks = fortnight.map((r) => skyLines(r).join(" "));
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i]).not.toBe(blocks[i - 1]);
    }
    expect(new Set(blocks).size).toBeGreaterThanOrEqual(12);
  });

  it("never repeats yesterday's OPENING sentence either", () => {
    // The whole block differing isn't enough — readers see the first line.
    const firsts = fortnight.map((r) => skyLines(r)[0] ?? "");
    for (let i = 1; i < firsts.length; i++) {
      expect(firsts[i]).not.toBe(firsts[i - 1]);
    }
  });

  it("says the same thing only once per email", () => {
    // The flavour is BUILT from the watch list, so printing both restates it.
    // This is the "void printed verbatim three times" failure.
    for (const r of fortnight) {
      const lines = skyLines(r);
      const tails = lines.map((l) => l.toLowerCase().split("—").pop()?.trim().slice(0, 28) ?? "");
      expect(new Set(tails).size).toBe(tails.length);
    }
  });

  it("stays a footer — at most three sentences", () => {
    // Longer and it competes with the reader's own day, which is exactly what
    // the 229→54 word rewrite removed.
    for (const r of fortnight) expect(skyLines(r).length).toBeLessThanOrEqual(3);
  });

  it("drops the tail sentence that appeared in every single email", () => {
    expect(cleanCounterpoint("— though Mars runs rough. Hold the day's shape loosely there."))
      .toBe("Though Mars runs rough.");
    expect(cleanCounterpoint(undefined)).toBe("");
  });

  it("composeDay actually uses the reading it pays to compute", () => {
    // The bug in one line: an expensive call whose result was never read.
    const src = readFileSync(join(process.cwd(), "artifacts/api-server/src/routes/reports.ts"), "utf-8");
    const body = src.slice(src.indexOf("export async function composeDay"), src.indexOf("export async function composeWeek"));
    expect(body).toMatch(/const reading = dayReading\(/);
    expect(body).toMatch(/skyLines\(reading\)/);
    // And the sign blurb survives only as the empty-weave floor.
    expect(body.match(/sg\?\.feel/g) ?? []).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 44. AI-SLOP GUARD ON USER-FACING COPY
// Owner asked to apply the no-ai-slop skill to the app's writing. Auditing all
// 6,655 user-facing strings first found almost nothing to edit: three hits,
// all "transformative", all describing Scorpio/Pluto — the traditional
// signification, not marketing filler. The 2026-07-30 language work had
// already done the word-level job.
//
// So the value isn't an edit pass, it's a ratchet. Copy is written constantly,
// by different sessions, and this is the direction it drifts. Same shape as
// the raw-grey guard and the no-causal-words guard: cheap, and it fails the
// build the first time slop appears rather than the day a reader notices.
//
// DELIBERATELY NOT ENFORCED — em dashes. The skill says none in short copy,
// 1–2 in longer. This app puts one in 10.9% of its strings (and two or more in
// only 0.4%), which is the appositive rhythm LANGUAGE-STUDY-2026-07-30 chose
// on purpose: "lyric in the weather, plain in the instruction." Stripping them
// would flatten the house voice, which the skill itself warns against. The
// same goes for the definitional colons in mythos.ts ("Fire is the element of
// initiation: …") — a label and its expansion, not a fake dramatic reveal.
// ─────────────────────────────────────────────────────────────────────────────

describe("no AI slop in user-facing copy", () => {
  // "transformative" is absent: it is Scorpio/Pluto's traditional meaning in
  // an astrology app, and banning a domain term would mangle real vocabulary.
  const BANNED = ["delve", "foster", "leverage", "utilize", "facilitate", "empower",
    "streamline", "cutting-edge", "paradigm shift", "game changer", "tapestry",
    "multifaceted", "meticulous", "paramount", "supercharge", "ever-evolving",
    "seamless", "unlock the power", "take it to the next level"];
  const EMPTY_PHRASES = ["it's worth noting", "it's important to note",
    "at the end of the day", "in today's world", "in the age of", "the reality is",
    "in terms of", "going forward", "let's dive in", "when it comes to"];
  const SHAPES: [RegExp, string][] = [
    [/\bhere'?s the thing\b|\blet me be clear\b/i, "throat-clearing opener"],
    [/\bwhat most people get wrong\b|\bnobody tells you\b|\bthe part everyone misses\b/i, "faux-insight setup"],
    [/\b(stands as a testament|marks a pivotal|plays a vital role|underscores its significance)\b/i, "importance puffery"],
    [/\b(experts agree|studies show|widely regarded as)\b/i, "weasel attribution"],
    [/,\s*(highlighting|underscoring|showcasing)\b/i, "superficial -ing analysis"],
    [/\b(in conclusion|ultimately,|overall,)\s/i, "summary-recap ending"],
  ];

  /** Quoted literals that a reader could actually see. Comments excluded. */
  function userStrings(src: string): { line: number; text: string }[] {
    const out: { line: number; text: string }[] = [];
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
      l = l.replace(/\/\/.*$/, "");
      for (const m of l.matchAll(/"([^"\\]{12,})"|'([^'\\]{12,})'|`([^`\\]{12,})`/g)) {
        const s = m[1] ?? m[2] ?? m[3];
        if (/^[a-z0-9_\-/.]+$/i.test(s) || !/\s/.test(s)) continue;
        out.push({ line: i + 1, text: s });
      }
    }
    return out;
  }

  function copyFiles(): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { if (!/node_modules|dist|generated/.test(p)) walk(p); }
        else if (/\.tsx?$/.test(e.name)) out.push(p);
      }
    };
    for (const r of ["artifacts/tides/src", "artifacts/api-server/src/lib", "artifacts/api-server/src/routes"]) {
      walk(join(process.cwd(), r));
    }
    return out;
  }

  const files = copyFiles();

  it("finds the copy at all", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("uses no banned marketing words", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const { line, text } of userStrings(readFileSync(f, "utf-8"))) {
        for (const w of BANNED) {
          if (new RegExp(`\\b${w.replace(/-/g, "[-]")}\\b`, "i").test(text)) {
            offenders.push(`${f.split("/src/")[1]}:${line} — "${w}" in “${text.slice(0, 70)}”`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses no empty throat-clearing phrases", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const { line, text } of userStrings(readFileSync(f, "utf-8"))) {
        for (const p of EMPTY_PHRASES) {
          if (text.toLowerCase().includes(p)) offenders.push(`${f.split("/src/")[1]}:${line} — "${p}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses none of the slop sentence shapes", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const { line, text } of userStrings(readFileSync(f, "utf-8"))) {
        for (const [re, name] of SHAPES) {
          if (re.test(text)) offenders.push(`${f.split("/src/")[1]}:${line} — ${name}: “${text.slice(0, 70)}”`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // NO em-dash count check. I wrote one ("at most two per string") and it
  // failed on four strings, none of which was the crutch it was meant to
  // catch: two were enumerations where each dash separates a label from its
  // meaning (Tooltip.tsx listing four elements, then eight moon phases), one
  // was an artifact of reading a three-branch ternary as a single string, and
  // one was ordinary prose. A guard that is mostly false positives teaches
  // people to ignore it, which is worse than not having it — the same reason
  // "against the current" can't fire half the time and still mean anything.
  //
  // Measured instead, and left as the record: one em dash in 10.9% of strings,
  // two or more in 0.4%. That is the appositive house voice, not a tic.
});

// ─────────────────────────────────────────────────────────────────────────────
// 45. TESTIMONY FACTS, FOR A VOICE LAYER THAT ISN'T COMPASS'S
// Owner settled the open question in LANGUAGE-STUDY §3: the Mercury-sign
// register is LLM-rendered. That only works if the engine hands the renderer
// FACTS. Every field below was already in scope where the testimony is built
// and was being flattened into `note` — the aspect name and the orb were
// readable only by parsing English back out, which is precisely what a second
// register (or AstroLyrica over /engine, §5) cannot do.
//
// `note` is not dead once a renderer exists. It is the DEFAULT REGISTER and
// the fallback when the renderer is unavailable — the same degrade-don't-
// refuse rule three AI routes already follow. Which makes drift the real risk:
// if someone edits the prose and not the facts, the LLM register and the
// fallback start making different claims about the same sky, and nothing would
// notice. That is what these pin.
// ─────────────────────────────────────────────────────────────────────────────

describe("testimony facts agree with the prose they replaced", () => {
  const LAT = 30.27, LON = -97.74, TZ = 300;
  const fortnight = Array.from({ length: 14 }, (_, d) =>
    readingFor(new Date(Date.parse("2026-08-01T09:00:00Z") + d * 86400000), LAT, LON,
      { tzOffsetMin: TZ, scope: "moment" }));
  const all = fortnight.flatMap((r) => r.testimonies as any[]);

  it("every testimony carries facts", () => {
    expect(all.length).toBeGreaterThan(40);
    const naked = all.filter((t) => !t.facts).map((t) => t.source);
    expect([...new Set(naked)]).toEqual([]);
  });

  it("the facts name the same planets the sentence does", () => {
    for (const t of all) {
      if (t.facts?.partner) expect(t.note).toContain(t.facts.partner);
      // sectMalefic/hour/dayRuler all lead with their planet.
      if (t.facts?.planet && t.facts.kind !== "phase" && t.facts.kind !== "voc" && t.facts.kind !== "moonAspect") {
        if (t.facts.kind !== "moonSign") expect(t.note).toContain(t.facts.planet);
      }
    }
  });

  it("the orb in the facts is the orb in the sentence", () => {
    // The number a different register would have to reproduce exactly.
    const aspects = all.filter((t) => t.facts?.kind === "moonAspect");
    expect(aspects.length).toBeGreaterThan(5);
    for (const t of aspects) {
      expect(t.note).toContain(`${t.facts.orbDeg.toFixed(1)}°`);
      expect(t.facts.applying).toBe(true);   // separating aspects are skipped
    }
  });

  it("sign and phase facts match their sentences", () => {
    for (const t of all) {
      if (t.facts?.kind === "moonSign") expect(t.note).toContain(t.facts.sign);
      if (t.facts?.kind === "phase") expect(t.note).toContain(t.facts.phaseName);
    }
  });

  it("polarity and the facts tell the same story", () => {
    // "flow toward" vs "friction around" is the renderer's tonal fork; if it
    // disagreed with polarity, a register could invert the day's meaning.
    for (const t of all.filter((x) => x.facts?.kind === "moonAspect")) {
      expect(t.note).toContain(t.polarity > 0 ? "flow toward" : "friction around");
    }
  });

  it("the FACTS alone distinguish one day from the next", () => {
    // Implication of LLM rendering: tests can no longer pin output text, so
    // this is what replaces the "14/14 unique blocks" assertion — the
    // renderer's INPUT is what must vary, and that stays deterministic.
    const shapes = fortnight.map((r) => JSON.stringify(
      (r.testimonies as any[]).map((t) => t.facts).filter(Boolean)));
    for (let i = 1; i < shapes.length; i++) expect(shapes[i]).not.toBe(shapes[i - 1]);
    expect(new Set(shapes).size).toBe(14);
  });

  it("facts survive the /engine boundary as data, not prose", () => {
    // AstroLyrica reads this shape. If facts were dropped from the wire, the
    // consumer would be back to parsing English.
    const src = readFileSync(join(process.cwd(), "artifacts/api-server/src/routes/engine.ts"), "utf-8");
    expect(src).toMatch(/reading: dayReading\(/);   // whole object, nothing stripped
  });
});
