import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_PREFS, mergePreferences, savePreferences, choosePreferences,
} from "../artifacts/tides/src/lib/preferences";

/**
 * PREFERENCES ACROSS DEVICES (audit 2026-08-19 §7).
 *
 * Preferences were localStorage-only, which on a per-device session model
 * means a lens — or a folded dashboard layout — set on a laptop does not
 * exist on the same person's phone.
 *
 * These pin the tie-break, which is the part that decides whose edit
 * survives. A rule that lives inside a useEffect is a rule nothing can check.
 */

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
});

const at = (savedAt: number) => ({ ...DEFAULT_PREFS, savedAt });

describe("choosing between a device's copy and the server's", () => {
  it("adopts the server copy when it is newer", () => {
    expect(choosePreferences(at(1000), at(2000))).toBe("remote");
  });

  it("keeps the local copy when this device is ahead, and seeds the server", () => {
    expect(choosePreferences(at(2000), at(1000))).toBe("local");
  });

  it("does nothing when they agree", () => {
    expect(choosePreferences(at(1000), at(1000))).toBe("neither");
  });

  it("treats an unstamped local blob as older than any stamped server copy", () => {
    // Everything written before savedAt existed. It must LOSE, so the first
    // sync after an upgrade takes the shared copy rather than clobbering it.
    expect(choosePreferences(DEFAULT_PREFS, at(1))).toBe("remote");
  });

  it("seeds the server when there is no server copy at all", () => {
    // Otherwise the column stays null until someone happens to change a
    // setting, and the feature looks broken to exactly the person most likely
    // to test it: someone who set everything up on one device, then opened
    // another.
    expect(choosePreferences(at(5000), null)).toBe("local");
  });

  it("does not push an unstamped local blob over nothing", () => {
    expect(choosePreferences(DEFAULT_PREFS, null)).toBe("neither");
  });
});

describe("the stored shape", () => {
  it("stamps on every save, and returns the stamped object", () => {
    const before = Date.now();
    const out = savePreferences(DEFAULT_PREFS);
    expect(out.savedAt).toBeGreaterThanOrEqual(before);
    // The caller holds this in state and hands it to the push; a stamp that
    // existed only in storage would make the tie-break read a stale value.
    expect(JSON.parse(store.get("tides-preferences")!).savedAt).toBe(out.savedAt);
  });

  it("defaults every key a stored blob is missing", () => {
    const merged = mergePreferences({ display: { astroDetail: "minimal" } } as any);
    expect(merged.display.astroDetail).toBe("minimal");
    expect(merged.display.uiDensity).toBe(DEFAULT_PREFS.display.uiDensity);
    expect(merged.notifications).toEqual(DEFAULT_PREFS.notifications);
  });

  it("never lets a missing or corrupt fold list throw on render", () => {
    // Every module calls .includes() on this on every render.
    expect(mergePreferences({} as any).display.collapsedModules).toEqual([]);
    expect(mergePreferences({ display: { collapsedModules: "work" } } as any)
      .display.collapsedModules).toEqual([]);
  });

  it("keeps an existing user at the full lens when they never chose one", () => {
    // The migration that predates astroDetail: only brand-new users get the
    // friendlier "medium" default.
    expect(mergePreferences({ display: { uiDensity: "expanded" } } as any)
      .display.astroDetail).toBe("full");
  });
});
