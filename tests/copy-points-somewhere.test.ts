import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Copy must not send a reader to a page that no longer exists.
 *
 * The Log's empty state read "Rate your day or jot a line in the journal on
 * **Today**" months after Today was folded into Home. The one instruction it
 * gave could not be followed, which is why it read as unhelpful rather than
 * merely wordy (owner, 2026-08-31).
 *
 * A page rename is cheap; finding every sentence that named the old one is not,
 * and nothing was checking.
 */
const SRC = "artifacts/tides/src";
const REMOVED_PAGES = ["Today", "Sky"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("copy does not point at pages that were removed", () => {
  it("confirms those pages really are gone, so this test is about something", () => {
    for (const page of REMOVED_PAGES) {
      expect(existsSync(join(SRC, "pages", `${page}.tsx`)), `${page}.tsx still exists`).toBe(false);
    }
  });

  it("never bolds a removed page name as a destination", () => {
    // `<b>Today</b>` is the shape the bug took: a name marked up as the place
    // to go. A bare word "today" is a date and stays legal.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const page of REMOVED_PAGES) {
        for (const form of [`<b>${page}</b>`, `<strong>${page}</strong>`]) {
          if (text.includes(form)) offenders.push(`${file}: ${form}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("does not tell anyone to go to one in a sentence", () => {
    const offenders: string[] = [];
    const patterns = REMOVED_PAGES.map(p => new RegExp(`(on|open|go to|visit|from) the ${p} (page|tab)`, "i"));
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      patterns.forEach((re, i) => {
        if (re.test(text)) offenders.push(`${file}: ${REMOVED_PAGES[i]}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
