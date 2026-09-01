import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A user correction must actually act.
 *
 * The Planner says "the read is a guess, not a verdict" and lets someone
 * change a task from fire to earth. `/plan/weave` kept only title, estimate,
 * energy and due date, then re-ran `associateDeterministic(title)` — so the
 * correction appeared on screen and was silently discarded at scheduling time.
 *
 * That is the most damaging shape a bug can take here, because it teaches that
 * inspectability is decorative. If the user can see the reason, the reason has
 * to be the one that acts.
 *
 * These are source-contract tests. The weave route needs a database and a
 * tester, so exercising it end to end belongs in the integration suite; what
 * is asserted here is that the discarding shape cannot come back.
 */

const src = readFileSync("artifacts/api-server/src/routes/plan.ts", "utf-8");

describe("the reviewed card is authoritative", () => {
  it("no longer reclassifies every item from its title at weave time", () => {
    // The exact line that discarded the edit.
    expect(src).not.toMatch(/const enriched = items\.map\(\(t\) => \(\{ \.\.\.t, assoc: associateDeterministic\(t\.title\) \}\)\)/);
  });

  it("uses the supplied classification and falls back only when absent", () => {
    // The claim is the `??` — the reviewed card wins, and the fallback runs
    // only when there is nothing to honour. Matched loosely on the arguments,
    // because pinning the exact call expression made this fail the moment the
    // fallback learned to read a task's length and energy as well as its
    // title, which is a change to what the fallback KNOWS and not to whether
    // it defers.
    expect(src).toMatch(/assoc: t\.assoc \?\? associateDeterministic\(/);
  });

  it("carries the edited fields through ingestion", () => {
    // Previously the map dropped everything but these four.
    for (const field of ["element", "windowType", "planets", "rationale"]) {
      expect(src, `ingestion drops ${field}`).toMatch(new RegExp(`${field}[:=]`));
    }
  });

  it("records where the classification came from", () => {
    expect(src).toMatch(/classificationSource/);
    expect(src).toMatch(/"user" \| "deterministic"/);
  });
});

describe("but request input is still validated", () => {
  it("only accepts the four real elements", () => {
    // Trusting the card must not mean trusting arbitrary POST bodies into the
    // scheduler. The four-element literal moved into a named constant when
    // multi-lane arrived (2026-08-13); both the single element and every
    // member of the `elements` array are still validated against it.
    expect(src).toMatch(/const EL = \["fire", "earth", "air", "water"\] as const/);
    expect(src).toMatch(/EL\.includes\(t\.element\)/);
    expect(src).toMatch(/\(EL as readonly string\[\]\)\.includes\(e\)/);
  });

  it("only accepts known window types", () => {
    expect(src).toMatch(/WINDOW_TYPES\.includes\(t\.windowType\)/);
  });

  it("falls back to the deterministic read when a field is unrecognised", () => {
    // With multi-lane, a card may name lanes without naming a primary — the
    // first lane stands in before the deterministic read is reached, and the
    // read is still the final fallback when neither was given.
    expect(src).toMatch(/element \?\? elements\[0\] \?\? derived\.element/);
    expect(src).toMatch(/windowType \?\? derived\.windowType/);
  });
});

describe("the client was already sending what the server ignored", () => {
  it("posts the full card, so this was purely a server-side discard", () => {
    const planner = readFileSync("artifacts/tides/src/components/Planner.tsx", "utf-8");
    expect(planner).toMatch(/element: string; windowType: string; planets: string\[\]; rationale: string/);
    expect(planner).toMatch(/tasks: cards/);
  });
});
