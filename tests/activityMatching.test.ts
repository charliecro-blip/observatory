import { describe, it, expect } from "vitest";
import { rankActivities, ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences.js";

const CONFIDENT = 2.0;   // the bar linesUp and dayWeaver use
const top = (text: string) => rankActivities(text, 3)[0] ?? null;

describe("activity matching", () => {
  // The most basic property there is, and two of forty-six failed it: an
  // activity whose keyword list contains no word from its own name could never
  // be classified automatically, by any caller, for any phrasing.
  it("every activity matches its own label", () => {
    const misses = ACTIVITIES
      .map(a => ({ a, r: top(a.label) }))
      .filter(({ a, r }) => !r || r.activity.key !== a.key || r.score < CONFIDENT)
      .map(({ a, r }) => `${a.label} → ${r ? `${r.activity.key}=${r.score.toFixed(2)}` : "nothing"}`);
    expect(misses).toEqual([]);
  });

  // A slash separates synonyms rather than making one long name. Requiring
  // every word of the joined string meant "Long run" could not match
  // "Long run / endurance" — the word "endurance" was missing.
  it("matches either side of a slashed label", () => {
    expect(top("Long run")?.activity.key).toBe("endurance");
    expect(top("Long run")!.score).toBeGreaterThanOrEqual(CONFIDENT);
  });

  // Plain `includes` matched "plan" inside "plants", so "Water the plants"
  // scored 2.00 for "Plan & strategize" — over the bar, and absurd.
  it("does not match a word inside a longer word", () => {
    const r = rankActivities("Water the plants", 5);
    const planning = r.find(x => x.activity.key === "strategize");
    expect(planning?.score ?? 0).toBeLessThan(CONFIDENT);
  });

  // ...but the boundary must not cost plurals, which is what made the fix
  // above lose "Water the plants" → "Garden / plant" in the first place.
  it("still matches a plural against a singular label", () => {
    expect(top("Water the plants")?.activity.key).toBe("garden");
  });

  // The regression that drove RIVAL_SCORE in linesUp. Loosening recall must
  // not resurrect it: the right answer has to keep its margin over the noise.
  it("keeps the memo away from meditation", () => {
    const r = rankActivities("Finish the Q3 positioning memo and circulate it to the three people who asked", 3);
    expect(r[0].activity.key).toBe("finish-polish");
    const meditate = r.find(x => /meditat/i.test(x.activity.label));
    if (meditate) expect(r[0].score - meditate.score).toBeGreaterThan(0.5);
  });

  // Recall must not become "matches everything". These have no home in the
  // palette and staying silent is the correct answer.
  it("stays below the bar for things it genuinely does not know", () => {
    for (const text of ["Reply to Dana", "Renew the domain", "Buy milk", "Book the flights before the fare changes"]) {
      const r = top(text);
      expect(r?.score ?? 0, `${text} matched ${r?.activity.label}`).toBeLessThan(CONFIDENT);
    }
  });
});
