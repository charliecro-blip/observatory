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

/** Must match the cycle key the check-in is currently running. */
export const CHECKIN_CYCLE_KEY = "2026-08-12-leo-eclipse";
export const CHECKIN_SAVE_KEY = `compass-nm-checkin-${CHECKIN_CYCLE_KEY}`;

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The current cycle's kept check-in, or null once it has expired. */
export function readCheckIn(): CheckInSaved | null {
  try {
    const raw = localStorage.getItem(CHECKIN_SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CheckInSaved;
    return s.until >= localDate() ? s : null;
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
