import { describe, it, expect } from "vitest";
import { matchActivity } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { associateDeterministic } from "../artifacts/api-server/src/lib/associate";

describe("shorthand the app can now decipher", () => {
  // The exact complaint: "make dr's appt" returned no signature at all
  // (owner, 2026-08-31: "I think the language, even tho it's shorthand here,
  // should be able to be deciphered by the app!").
  it("reads 'make dr's appt' as admin-errands", () => {
    const hit = matchActivity("make dr's appt");
    expect(hit?.activity.key).toBe("admin-errands");
  });

  it("reads common shorthand for the same kind of work", () => {
    for (const text of [
      "book the dentist", "reschedule the appt", "confirm the appointment",
      "renew my license", "pay the bill", "refill the prescription",
    ]) {
      const hit = matchActivity(text);
      expect(hit?.activity.key, text).toBe("admin-errands");
    }
  });
});

describe("matchActivity is word-boundary safe, not substring", () => {
  // This is the bug that made the shorthand fix dangerous to do carelessly:
  // matchActivity used raw .includes(), so the existing keyword "forms"
  // already matched inside "informs", "performs", "platforms" — any task
  // mentioning any of those was silently pulled toward admin-errands before
  // this fix. Adding "dr" as a keyword under the OLD matcher would have been
  // worse: "dr" is a substring of "hydrate", "address", "bedroom".
  it("does not match 'dr' inside unrelated words", () => {
    for (const text of ["hydrate and stretch", "address the letter", "a walk in the woods"]) {
      const hit = matchActivity(text);
      expect(hit?.activity.key, text).not.toBe("admin-errands");
    }
  });

  it("does not match 'form'/'forms' inside unrelated words", () => {
    // Live bug before the fix: all three of these matched admin-errands via
    // "forms" as a raw substring of "informs"/"performs"/"platforms".
    for (const text of [
      "inform the team about the launch",
      "the routine felt easy to perform",
      "compare social platforms",
    ]) {
      const hit = matchActivity(text);
      expect(hit?.activity.key, text).not.toBe("admin-errands");
    }
  });

  it("still matches the plural via the existing (s|es)? tolerance", () => {
    expect(matchActivity("fill out the forms")?.activity.key).toBe("admin-errands");
    expect(matchActivity("book the appointments")?.activity.key).toBe("admin-errands");
  });

  it("still matches a task's own label as a whole word", () => {
    // "Water the plants" -> "Garden / plant" is the case hasWord's own
    // comment cites; confirm it survives the switch from a second matcher.
    const hit = matchActivity("water the plants");
    expect(hit?.activity.key).toBe("garden");
  });
});

describe("the association layer sees the same fix end to end", () => {
  it("associateDeterministic resolves the shorthand via correspondence, not a shrug", () => {
    const a = associateDeterministic("make dr's appt");
    expect(a.source).toBe("correspondence");
    expect(a.activityKey).toBe("admin-errands");
    expect(a.element).toBe("air");
  });
});
