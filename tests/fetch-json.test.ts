import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fetchJson, HttpError } from "../artifacts/tides/src/lib/fetchJson";

/**
 * "I could not retrieve your life" must never render as "there is nothing in
 * your life."
 *
 * Most queries called r.json() without checking r.ok, so a 500 or a dropped
 * connection parsed the error body and handed it to react-query as DATA. The
 * component rendered an empty task list, no Guiding Stars, a free week.
 * react-query has a perfectly good error state; nothing ever threw, so it was
 * never reached.
 */

const mockFetch = (impl: any) => { (globalThis as any).fetch = vi.fn(impl); };
afterEach(() => { vi.restoreAllMocks(); });

describe("failure throws instead of parsing", () => {
  it("throws on a 500 rather than returning the error body", () => {
    mockFetch(async () => new Response("upstream exploded", { status: 500 }));
    return expect(fetchJson("/api/tasks")).rejects.toBeInstanceOf(HttpError);
  });

  it("throws on a 500 that returns a JSON array", async () => {
    // The nastiest shape: a failing endpoint whose body happens to parse as an
    // empty list. Without the status check this is indistinguishable from "you
    // have no tasks".
    mockFetch(async () => new Response("[]", {
      status: 500, headers: { "content-type": "application/json" },
    }));
    await expect(fetchJson("/api/tasks")).rejects.toBeInstanceOf(HttpError);
  });

  it("carries the status and url so the surface can say which thing failed", async () => {
    mockFetch(async () => new Response("nope", { status: 503 }));
    await expect(fetchJson("/api/habits")).rejects.toMatchObject({
      status: 503, url: "/api/habits",
    });
  });

  it("still returns the body on success", async () => {
    mockFetch(async () => new Response(JSON.stringify([{ id: 1 }]), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await expect(fetchJson<{ id: number }[]>("/api/tasks")).resolves.toEqual([{ id: 1 }]);
  });

  it("returns an empty list as an empty list, not an error", async () => {
    // Genuinely empty must stay genuinely empty — the fix must not invert.
    mockFetch(async () => new Response("[]", {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await expect(fetchJson("/api/tasks")).resolves.toEqual([]);
  });
});

describe("absence is a decision, not an accident", () => {
  it("treats a listed status as data when asked", async () => {
    // /api/natal-chart answers 404 when you have not added one. That is a real
    // answer. Listing it explicitly keeps it a choice someone made rather than
    // the accidental behaviour of every endpoint at once.
    mockFetch(async () => new Response("", { status: 404 }));
    await expect(fetchJson("/api/natal-chart", {
      absentStatuses: [404], absentValue: null,
    })).resolves.toBeNull();
  });

  it("still throws for statuses that were not listed", async () => {
    mockFetch(async () => new Response("", { status: 500 }));
    await expect(fetchJson("/api/natal-chart", {
      absentStatuses: [404], absentValue: null,
    })).rejects.toBeInstanceOf(HttpError);
  });
});

describe("the life-data queries were migrated", () => {
  it("no longer bare-parses tasks, stars or habits", () => {
    // Today.tsx was on this list until its life-data queries moved out —
    // to hooks/useHomeData and components/RitualCard (2026-08-19). A file
    // that no longer ASKS for tasks, stars or habits cannot be required to
    // ask for them through fetchJson; the claim is about the queries, so
    // the list follows them.
    for (const f of [
      "artifacts/tides/src/hooks/useTides.ts",
      "artifacts/tides/src/hooks/useHomeData.ts",
      "artifacts/tides/src/pages/GuidingStarsHub.tsx",
      "artifacts/tides/src/components/RitualCard.tsx",
    ]) {
      const src = readFileSync(f, "utf-8");
      expect(src, `${f} should use fetchJson`).toMatch(/fetchJson\(/);
    }
  });

  it("routes north-stars through it", () => {
    const src = readFileSync("artifacts/tides/src/hooks/useTides.ts", "utf-8");
    expect(src).toMatch(/fetchJson\("\/api\/planning\/north-stars"/);
  });
});
