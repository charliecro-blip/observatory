/**
 * The turning-point check-in's kept answers — ONE definition of where they
 * live, so more than one surface can read them.
 *
 * The integration audit (2026-08-13, gap 3) found the check-in writing a
 * release line, a reclaim line and per-star "still true / needs a look"
 * marks into localStorage that nothing else could see — including the
 * Guiding Stars page, which is where its own kept card sends you to act on
 * exactly those marks ("2 stars marked for a look →" led to a page that
 * knew nothing about them).
 *
 * This is a stopgap with a known ceiling, stated plainly: localStorage is
 * per-device, so a mark set on a phone is invisible on a laptop. The proper
 * fix is a column on `goals` and a migration; that is a schema change
 * against production and belongs in its own deliberate pass. Until then the
 * key has one owner instead of two copies.
 *
 * KEYS ARE PER-CYCLE AND DERIVED, since 2026-08-15. The save key used to be
 * one exported constant naming the curated cycle, which worked only while
 * every cycle HAD a curated block. The check-in now runs on any computed
 * lunation (HOME study M3 — the ritual must survive an unwritten month), so
 * a cycle without curation keys itself off its own computed start date, and
 * readers scan the namespace for whichever cycle's answers are still alive
 * rather than importing one frozen name. Everything stays inside `compass-`
 * so purgeLocalData() wipes it on account deletion.
 */

export interface CheckInSaved {
  release: string;
  reclaim?: string;
  oneShot: string;
  /** Keyed by goal id (as string), as the check-in writes it. */
  stars: Record<string, "true" | "look">;
  savedAt: string;
  revisedAt?: string;
  until: string;
}

/** The curated block's cycle key. Named here so the check-in's CYCLE block
 *  and anything comparing against it can never name different cycles. */
export const CHECKIN_CYCLE_KEY = "2026-08-12-leo-eclipse";

const PREFIX = "compass-nm-checkin-";

/** Where a given cycle's answers live. */
export const checkInSaveKey = (cycleKey: string) => `${PREFIX}${cycleKey}`;

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The most recent kept check-in that has not expired, from ANY cycle.
 *
 * A scan rather than a lookup, because the reader (Guiding Stars) does not
 * know which cycle wrote the marks — and should not have to: "which stars
 * did I flag at the last turning point?" is one question regardless of
 * whether that turning point had a curated block.
 */
export function readCheckIn(): CheckInSaved | null {
  try {
    const today = localDate();
    let best: CheckInSaved | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const s = JSON.parse(raw) as CheckInSaved;
      if (s.until < today) continue;
      if (!best || s.savedAt > best.savedAt) best = s;
    }
    return best;
  } catch { return null; }
}

/** Goal ids the person flagged for a second look at the turning point. */
export function starsNeedingLook(): Set<number> {
  const s = readCheckIn();
  if (!s?.stars) return new Set();
  return new Set(
    Object.entries(s.stars)
      .filter(([, v]) => v === "look")
      .map(([id]) => Number(id))
      .filter(n => Number.isFinite(n)),
  );
}
