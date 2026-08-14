// The first-run spotlight tour — step definitions and persistence.
//
// Copy lives here, OUTSIDE the page components, so the tour reads as one piece
// of writing and a page refactor can't orphan half a sentence. Each step
// anchors to a real element via [data-tour="…"]; the overlay finds it at show
// time, so the tour teaches the actual interface rather than a diagram of it
// (beta pass 2026-08-01 — this replaces the "New here?" reading strip).

export const TOUR_VERSION = 1;

export interface TourStep {
  /** Matches a data-tour attribute somewhere in the live DOM. */
  anchor: string;
  title: string;
  body: string;
  /** Label for the advance button on this step (default "Next"). */
  cta?: string;
}

// Five stops, one per job, all reachable from Today — the tour never navigates
// away mid-flight (a route change under a spotlight is disorienting; the last
// step's CTA is the one deliberate exit). Stops that describe another surface
// anchor to its nav tab rather than to the surface itself, for that reason.
//
// "Set a direction" moved from Today's Guiding Stars card to the Home tab when
// the Home/Today split sent star progress to Home. SpotlightTour survives a
// missing anchor by advancing past it, which is the right behaviour and also
// the reason this needed catching by hand: the tour would have gone on working
// while quietly teaching four things instead of five.
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "today-hero",
    title: "Read the moment",
    body: "This is the current moment — what kind of time it is, how strong it is, and what it favors. Conditions, not fate: the sky describes the weather, you steer.",
  },
  {
    anchor: "nav-home",
    title: "Set a direction",
    body: "Guiding Stars are the longer things you're steering toward, and Home keeps their progress in view alongside your list, so today stays connected to somewhere.",
  },
  {
    anchor: "nav-plan",
    title: "Put it in time",
    body: "Paste a to-do list in Plan and Compass weaves it into windows that suit the work — or pick the right day to begin something. Nothing is scheduled until you approve it.",
  },
  {
    anchor: "nav-tabs",
    title: "The loop",
    body: "Read Today. Steer by your Stars. Place the next moves in Plan. Calendar holds the wider view — and the evening asks how the day actually went.",
  },
  {
    anchor: "today-density",
    title: "Depth when you want it",
    body: "The full instrument panel — every layer of the sky behind a reading — is one tap away. Start light; add depth when you're curious.",
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

/** Should the tour auto-run right now? Only for accounts with no verdict on
 *  the CURRENT version — completing or skipping v1 both count as a verdict. */
export function tourPending(testerId: string | null): boolean {
  const r = tourRecord(testerId);
  return !r || (r.tourVersion !== TOUR_VERSION) || (!r.completedAt && !r.skippedAt);
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
