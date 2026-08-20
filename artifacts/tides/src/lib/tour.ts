// The first-run spotlight tour — step definitions and persistence.
//
// Copy lives here, OUTSIDE the page components, so the tour reads as one piece
// of writing and a page refactor can't orphan half a sentence. Each step
// anchors to a real element via [data-tour="…"]; the overlay finds it at show
// time, so the tour teaches the actual interface rather than a diagram of it
// (beta pass 2026-08-01 — this replaces the "New here?" reading strip).

// v2 (2026-08-18): the walkthrough moved to HOME, because that is where a new
// account actually lands. v1 anchored its first stop to Today's hero and was
// armed only on Today, so for anyone who followed the default path it never
// ran at all (AUDIT-JOURNEY-2026-08-18, J1). Bumping the version deliberately
// re-offers the tour to accounts that carry a v1 verdict: the walkthrough they
// answered is not the one that exists now, and most of them never saw it.
export const TOUR_VERSION = 3;

export interface TourStep {
  /** Matches a data-tour attribute somewhere in the live DOM. */
  anchor: string;
  title: string;
  body: string;
  /** Label for the advance button on this step (default "Next"). */
  cta?: string;
}

// Five stops, one per job, ALL ANCHORED TO HOME OR THE NAV — the tour never
// navigates away mid-flight (a route change under a spotlight is
// disorienting; the last step's CTA is the one deliberate exit), so every
// anchor has to exist on the surface the tour runs on. Stops that describe
// another surface point at its nav tab instead.
//
// Every anchor here survives a COLD START, which is the state a first-run
// account is actually in. That rules out the loop hero (renders nothing until
// something is held) and the Guiding Stars card (renders nothing until a star
// exists) — SpotlightTour advances past a missing anchor silently, so an
// anchor that isn't there on day one is a stop nobody is ever taught.
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "home-work",
    title: "Start with what you're holding",
    body: "Type a line and press Enter — that's the whole form. Say when, and the date is read from your words. Everything you're carrying lives in this one list, split by when it's due rather than by category.",
  },
  {
    anchor: "home-answer",
    title: "The answer to \"what now\"",
    body: "Once there's something on your list, Compass names one thing to do next and says why. Its reasons are deadlines, your calendar, and — if you want it — the sky. When nothing stands out, it says that instead of inventing work.",
  },
  {
    anchor: "nav-plan",
    title: "Put it in time",
    body: "Hand Plan a list and it finds real windows in your week, working around your calendar and your waking hours. Nothing reaches your calendar until you keep it.",
  },
  {
    anchor: "nav-work",
    title: "Give it a direction",
    body: "Guiding Stars are the longer things you're steering toward. Tasks, habits and short sprints can all serve one, so an ordinary Tuesday stays connected to somewhere.",
    cta: "Set my first Guiding Star",
  },
];

// ── Persistence — versioned and tester-scoped ────────────────────────────────
// Not one global browser flag: a second tester on the same machine gets their
// own first run, and bumping TOUR_VERSION after a major nav change can justify
// showing a new short tour without re-running this one for everyone.

export interface TourRecord {
  tourVersion: number;
  completedAt?: string;
  skippedAt?: string;
  lastStep?: number;
}

const key = (testerId: string | null) => `compass-tour-${testerId ?? "anon"}`;

export function tourRecord(testerId: string | null): TourRecord | null {
  try {
    const raw = localStorage.getItem(key(testerId));
    return raw ? (JSON.parse(raw) as TourRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Should the tour auto-run right now?
 *
 * ONLY FOR SOMEONE WHO HAS NEVER GIVEN A VERDICT. Completing it or skipping
 * it both count, and they count FOREVER — not per version.
 *
 * This used to re-run whenever TOUR_VERSION changed, which meant the nav
 * change of 2026-08-19 re-explained the app to someone who had been using it
 * for weeks (owner, same day: "I pulled up compass again and got the intro
 * again, even though I've already used it"). The version was doing two jobs
 * and the second one was wrong: a layout that moved is not a reason to teach
 * somebody their own app again. It still RECORDS which version they saw,
 * which is the useful half.
 *
 * If a change ever genuinely warrants re-teaching, that is a deliberate act —
 * Settings has "Replay the walkthrough" — and not a side effect of an
 * unrelated commit bumping a constant.
 */
export function tourPending(testerId: string | null): boolean {
  const r = tourRecord(testerId);
  return !r || (!r.completedAt && !r.skippedAt);
}

export function saveTourRecord(testerId: string | null, patch: Partial<TourRecord>): void {
  try {
    const prev = tourRecord(testerId);
    const next: TourRecord = { tourVersion: TOUR_VERSION, ...(prev?.tourVersion === TOUR_VERSION ? prev : {}), ...patch };
    localStorage.setItem(key(testerId), JSON.stringify(next));
  } catch { /* private mode — the tour just re-offers next time */ }
}

/** Settings → "Replay the walkthrough". Clears the verdict; Today re-runs it. */
export function resetTour(testerId: string | null): void {
  try { localStorage.removeItem(key(testerId)); } catch { /* ignore */ }
}
