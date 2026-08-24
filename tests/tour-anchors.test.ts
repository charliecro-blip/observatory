import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TOUR_STEPS } from "../artifacts/tides/src/lib/tour.js";

/**
 * THE TOUR'S ANCHORS HAVE TO EXIST.
 *
 * SpotlightTour advances past a missing anchor instead of throwing, which is
 * right for a walkthrough — a first-run account should never meet a crash —
 * and is why this file exists. The failure mode it creates is silent: delete
 * the element a step points at and the step simply stops happening. Nothing
 * errors, nothing goes red, and the tour keeps reporting the same number of
 * steps while teaching one fewer.
 *
 * That is not hypothetical. `home-answer` lost its target in 825b08e and went
 * on "running" for weeks; tour.ts carried a comment promising every anchor
 * survives a cold start the entire time.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It proves every anchor has a provider
 * in the source. It cannot prove the provider renders on a cold start — that
 * needs the running app, and the walkthrough in the release rehearsal is where
 * that gets checked. A necessary condition, cheaply, on every commit.
 */
const SRC = "artifacts/tides/src";

function clientFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) clientFiles(join(dir, e.name), out);
    else if (/\.tsx?$/.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

/**
 * Every anchor name the app can produce.
 *
 * Deliberately reads string literals out of the whole `data-tour=` expression
 * rather than matching `data-tour="x"`, because two of the four live anchors
 * are handed out by a ternary on the tab id:
 *
 *     data-tour={t.id === "launch" ? "nav-plan" : ... : undefined}
 *
 * A test that only understood the static form would report those as missing —
 * the same false alarm a hand-written grep produced while this was being
 * investigated.
 */
function providedAnchors(): Set<string> {
  const found = new Set<string>();
  for (const f of clientFiles(SRC)) {
    const src = readFileSync(f, "utf8");
    if (f.endsWith("SpotlightTour.tsx")) continue;   // the reader, not a provider
    for (const m of src.matchAll(/data-tour=(?:"([^"]+)"|\{([^}]*)\})/g)) {
      if (m[1]) found.add(m[1]);
      else for (const lit of (m[2] ?? "").matchAll(/"([^"]+)"/g)) found.add(lit[1]);
    }
  }
  return found;
}

describe("every tour step points at something that exists", () => {
  const provided = providedAnchors();

  it("finds the client source and some anchors at all", () => {
    expect(clientFiles(SRC).length).toBeGreaterThan(30);
    expect(provided.size).toBeGreaterThan(0);
  });

  it("has a provider for every TOUR_STEPS anchor", () => {
    const orphans = TOUR_STEPS.map(s => s.anchor).filter(a => !provided.has(a));
    expect(
      orphans,
      `tour steps whose anchor no element provides — these skip in silence:\n  ${orphans.join("\n  ")}`,
    ).toEqual([]);
  });

  it("names each anchor once, so two steps cannot fight over one element", () => {
    const seen = TOUR_STEPS.map(s => s.anchor);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
