import { describe, it, expect } from "vitest";

/**
 * A DOOR THAT OPENS.
 *
 * `useFold` gained inherited folds when the four-zone Home replaced three
 * sections with one "readday" door: an account that had folded "reading" and
 * "tide" before that door existed should find it closed, because that is what
 * they already asked for.
 *
 * The inheritance made `isFolded` stop meaning "is in the list", and `toggle`
 * still assumed it did. So the first click ADDED readday to the folded list —
 * still folded — and the second removed it, letting the inheritance fold it
 * again. Two clicks, no change, no way in. Found by a person using the app,
 * not by anything here, which is why this exists.
 *
 * The reducer is duplicated rather than imported because useFold is a React
 * hook wrapped around a preferences context; the arithmetic is the part worth
 * pinning, and it is small enough to state exactly.
 */
const INHERITS: Record<string, string[]> = { readday: ["reading", "tide"] };

const isFolded = (list: string[], id: string) =>
  list.includes(id) || (!list.includes(id) && (INHERITS[id] ?? []).some(h => list.includes(h)));

const toggle = (list: string[], id: string) => {
  const heirs = INHERITS[id] ?? [];
  return isFolded(list, id)
    ? list.filter(x => x !== id && !heirs.includes(x))
    : [...list, id];
};

describe("an inherited fold can still be opened", () => {
  it("reads as folded when only the ids it replaced are listed", () => {
    expect(isFolded(["reading", "tide"], "readday")).toBe(true);
  });

  it("OPENS on the first click", () => {
    // The whole bug: this used to still be true.
    const after = toggle(["reading", "tide"], "readday");
    expect(isFolded(after, "readday")).toBe(false);
  });

  it("stays open — the inheritance does not creep back", () => {
    let list = toggle(["reading", "tide"], "readday");
    expect(isFolded(list, "readday")).toBe(false);
    // and a round trip still lands where it should
    list = toggle(list, "readday");
    expect(isFolded(list, "readday")).toBe(true);
    list = toggle(list, "readday");
    expect(isFolded(list, "readday")).toBe(false);
  });

  it("leaves ordinary folds alone", () => {
    expect(isFolded([], "work")).toBe(false);
    expect(isFolded(toggle([], "work"), "work")).toBe(true);
    expect(isFolded(toggle(toggle([], "work"), "work"), "work")).toBe(false);
  });
});
