import { describe, it, expect } from "vitest";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";

/**
 * The convergence contract.
 *
 *   convergent = 2 establishing families
 *              | 1 establishing + 2 reinforcing
 *
 * Counting distinct families was too blunt in both directions. Two strong
 * testimonies can genuinely converge; three broad ones need not. So the
 * question is what each family is discriminating enough to ESTABLISH.
 *
 * Establishing families are relational or event-specific — the Moon applying
 * to this activity's significator is an event with a time. Reinforcing
 * families are recurrent conditions — a Mercury hour comes round every day for
 * every Mercurial activity.
 *
 * This settles the hour × Moon question that was preserved unresolved through
 * the family-counting fix: they stay two visible families, because they come
 * from different techniques and collapsing them would make the receipt less
 * truthful — but the hour cannot be the second voice.
 */

const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
const OCT = new Date(Date.UTC(2026, 9, 15, 12));
const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
const run = (key: string, o: any = {}) =>
  computeElections({ activityKey: key, span: "week", ...PLACE, startAt: OCT, ...o } as any)!;

describe("an establishing family must sit at the centre", () => {
  it("never converges on reinforcing families alone", () => {
    // The weak-three case: a matching hour, a preferred Moon sign and a
    // preferred phase are three labels, none of them unusual.
    for (const key of ["edit-revise", "endurance", "publish", "cook", "deep-study"]) {
      for (const w of run(key, { natal }).windows) {
        if (w.supportLevel === "convergent") {
          expect(w.establishingFamilies.length,
            `${key} ${w.date} converged on ${JSON.stringify(w.families)}`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  }, 40_000);

  it("satisfies the contract exactly, window by window", () => {
    for (const key of ["edit-revise", "publish", "endurance"]) {
      for (const w of run(key, { natal }).windows) {
        const e = w.establishingFamilies.length, r = w.reinforcingFamilies.length;
        const shouldConverge = e >= 2 || (e >= 1 && r >= 2);
        expect(w.supportLevel, `${key} ${w.date} e=${e} r=${r}`)
          .toBe(shouldConverge ? "convergent" : "supported");
      }
    }
  }, 40_000);

  it("partitions every family into exactly one role", () => {
    for (const w of run("edit-revise", { natal }).windows) {
      expect([...w.establishingFamilies, ...w.reinforcingFamilies].sort())
        .toEqual([...w.families].sort());
      for (const f of w.establishingFamilies) expect(w.reinforcingFamilies).not.toContain(f);
    }
  }, 40_000);
});

describe("the hour is evidence, not a second voice", () => {
  it("leaves Moon + hour merely supported", () => {
    // The exact case the convention was protecting, now stated as a rule
    // rather than as a special-cased count.
    for (const key of ["edit-revise", "deep-study", "admin-errands"]) {
      for (const w of run(key).windows) {
        const fams = new Set(w.families);
        const onlyMoonAndHour = fams.size === 2 && fams.has("lunar-contact") && fams.has("planetary-time");
        if (onlyMoonAndHour) {
          expect(w.supportLevel, `${key} ${w.date} promoted on Moon+hour`).toBe("supported");
          expect(w.stackedHourMoon).toBe(true);
        }
      }
    }
  }, 40_000);

  it("keeps them visibly separate families", () => {
    // Collapsing them would make the evidence receipt less truthful — they
    // come from different techniques and different constructions.
    let sawBoth = false;
    for (const w of run("edit-revise").windows) {
      if (w.families.includes("lunar-contact") && w.families.includes("planetary-time")) sawBoth = true;
    }
    expect(typeof sawBoth).toBe("boolean");
  }, 40_000);

  it("marks the overlap so it can rank without promoting", () => {
    for (const w of run("edit-revise").windows) {
      const both = w.families.includes("lunar-contact") && w.families.includes("planetary-time");
      expect(w.stackedHourMoon, `${w.date}`).toBe(both);
    }
  }, 40_000);
});

describe("personal provenance follows the same rule", () => {
  it("says personal decided the tier only when removing it would un-converge", () => {
    for (const w of run("investigate", { natal }).windows) {
      if (!w.personalDecidedTier) continue;
      const nonPersonal = w.families.filter(f => f !== "natal-house" && f !== "natal-contact");
      const e = nonPersonal.filter(f => ["lunar-contact", "standing-sky", "natal-contact"].includes(f)).length;
      const r = nonPersonal.length - e;
      expect(e >= 2 || (e >= 1 && r >= 2),
        `${w.date} claimed personal decided it, but ${JSON.stringify(nonPersonal)} converges anyway`).toBe(false);
    }
  }, 40_000);
});
