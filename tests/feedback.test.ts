import { describe, it, expect } from "vitest";
import { KINDS, CONTEXT_KEYS, NOTE_MAX, cleanContext } from "../artifacts/api-server/src/lib/feedbackContext.js";

describe("the feedback door keeps only what it promised to keep", () => {
  // The point of an allowlist over a passthrough: the client cannot grow a
  // habit of attaching more state and quietly start posting a journal line
  // into an analytics table. New context has to be added HERE, deliberately.
  it("drops any key it was not told to keep", () => {
    const out = cleanContext({
      view: "home",
      journalEntry: "a private thing I wrote this morning",
      email: "someone@example.com",
      chart: { sun: "Virgo" },
    });
    expect(out).toEqual({ view: "home" });
  });

  it("keeps every key it was told to keep", () => {
    const full = Object.fromEntries(CONTEXT_KEYS.map(k => [k, "x"]));
    expect(Object.keys(cleanContext(full)).sort()).toEqual([...CONTEXT_KEYS].sort());
  });

  it("caps a context value rather than storing a payload", () => {
    const out = cleanContext({ view: "a".repeat(5000) });
    expect(out.view.length).toBe(200);
  });

  it("survives junk instead of an object", () => {
    for (const junk of [null, undefined, "string", 42, []]) {
      expect(() => cleanContext(junk)).not.toThrow();
    }
    expect(cleanContext(null)).toEqual({});
  });

  it("skips empty and null values instead of storing blanks", () => {
    expect(cleanContext({ view: "", surface: null, rhythm: "field" })).toEqual({ rhythm: "field" });
  });
});

describe("the five doors", () => {
  it("are the five the audit named", () => {
    expect([...KINDS].sort()).toEqual(["broken", "confusing", "delightful", "idea", "wrong"]);
  });

  it("caps the note so a paste cannot become a payload", () => {
    expect(NOTE_MAX).toBeLessThanOrEqual(2000);
    expect(NOTE_MAX).toBeGreaterThan(200);
  });
});
