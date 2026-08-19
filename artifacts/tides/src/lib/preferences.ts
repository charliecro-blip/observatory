const KEY = "tides-preferences";

export interface NotificationPrefs {
  enabled: boolean;
  quietStart: number;   // 22 = 10pm
  quietEnd: number;     // 7  = 7am
  hourShifts: boolean;
  hourShiftPlanets: string[] | "all";  // ["Sun","Moon",...] or "all"
  crossings: boolean;
  crossingPlanets: "benefic" | "malefic" | "both" | "all";
  crossingAngles: ("ASC" | "MC" | "DSC" | "IC")[];
  newMoon: boolean;
  fullMoon: boolean;
  vocAlert: boolean;
  highQuality: boolean;  // quality score spikes
}

export interface DisplayPrefs {
  railSections: ("moon" | "aspects" | "retrogrades" | "hour" | "transits")[];
  todayShowVOC: boolean;
  todayShowWave: boolean;
  todayShow14Day: boolean;
  todayShowJournal: boolean;
  compactRail: boolean;
  timeFormat: "12h" | "24h";
  // Angular-crossing markers on the Today wave — a tuning knob, so it lives
  // in Settings rather than as a button on the home page.
  todayShowCrossings: boolean;
  // Auto-rollover: carry undone, overdue TASKS to today once per day. Never
  // moves a scheduled window — a window is a claim on a specific moment, and
  // relocating one silently would retract the reason it existed.
  autoRollover: boolean;
  // Vocabulary graduation — "plain" speaks only the app's feeling-language
  // (Deep Tide, Surge); "bilingual" adds the sky's own words next to them
  // (Moon in Pisces, ☽ □ ♄) so fluency grows by exposure. Superseded by
  // astroDetail for whole-surface gating; kept for the Dashboard toggle.
  skyLanguage: "plain" | "bilingual";
  // How much astrology the whole app shows (owner 2026-07-22 — "a lot of
  // people's eyes glaze over at the jargon; that narrows our user base").
  // The backend engine is identical at every level; only what's SHOWN changes.
  //   minimal — a plain weather app: guidance and best times, no glyphs, no
  //             aspect/planet jargon, the instrument rail collapsed away.
  //   medium  — the moon, the day's character, best times; light sky words,
  //             but no dense aspect tables or transit read-outs.
  //   full    — everything, bilingual: the sky's own words and glyphs.
  astroDetail: "minimal" | "medium" | "full";
  // How MUCH is on screen (owner 2026-07-23 — "still unruly; too many moving
  // pieces on the dashboard... cut to the core functions by default, other
  // features available as add-ons"). Orthogonal to astroDetail (which gates
  // jargon): uiDensity gates MODULES.
  //   essential — the core journey only: the tide (compass), today's plan,
  //               your aims, the daily ritual loop. Default.
  //   expanded  — the full instrument panel (rhythm, big sky, pulse,
  //               conditions, elemental balance, teachable moments…).
  uiDensity: "essential" | "expanded";
  /**
   * Modules the person has folded shut, by id (audit 2026-08-19 §7).
   *
   * The owner asked for a dashboard whose modules can be rearranged, minimized
   * and expanded. This is the minimize half, and it is the half worth having:
   * free drag-and-drop would let someone move the receipt above the answer it
   * is a receipt FOR, which is not customization but breaking an argument the
   * page is making.
   *
   * A COLLAPSED MODULE IS NOT A HIDDEN ONE. It keeps its header and a one-line
   * summary of what it holds, so folding something shut is a density choice
   * rather than a disappearance — nothing a person chose to fold can quietly
   * become a gap they were never told about, which is the same rule that makes
   * the app report gaps instead of dropping them.
   *
   * Ids, never indices: a stored index would silently point at a different
   * module the next time the page's order changes.
   */
  collapsedModules: string[];
}

export type AstroDetail = DisplayPrefs["astroDetail"];
export type UiDensity = DisplayPrefs["uiDensity"];

// One place that decides what each level reveals, so every surface gates the
// same way. Booleans read as "show this?".
export function astroReveal(level: AstroDetail) {
  const full = level === "full";
  const min = level === "minimal";
  return {
    glyphs: !min,            // sign / planet / aspect glyphs
    aspects: full,           // aspect tables, "the big sky", transit read-outs
    planetaryHours: !min,    // the day/hour rulers
    degrees: full,           // orbs, degrees, exact times to the minute
    bilingual: full,         // the sky's own words beside the plain ones
    railDense: full,         // the full instrument rail vs a collapsed essentials rail
    moonDetail: !min,        // moon sign/phase surfaced (kept even at minimal? no — hidden)
  };
}

export interface TimingPrefs {
  watchPlanets: string[];    // highlight these in Rail ("Sun","Moon","Venus"…)
  defaultWindowType: string; // pre-select in quick-capture
}

export interface TidesPreferences {
  notifications: NotificationPrefs;
  display: DisplayPrefs;
  timing: TimingPrefs;
  version: number;
  /**
   * When this object was last written, epoch ms.
   *
   * The tie-breaker between a device's local copy and the server's, and the
   * only thing that makes "last write wins" mean what it says — without it
   * the rule is really "whoever loaded most recently wins", which quietly
   * discards the newer edit whenever a second device opens the app. Absent on
   * blobs written before this existed, which reads as 0 and so loses to any
   * server copy, and that is the right way round for the first sync.
   */
  savedAt?: number;
}

export const DEFAULT_PREFS: TidesPreferences = {
  notifications: {
    enabled: false,
    quietStart: 22,
    quietEnd: 7,
    hourShifts: true,
    hourShiftPlanets: "all",
    crossings: true,
    crossingPlanets: "both",
    crossingAngles: ["ASC", "MC"],
    newMoon: true,
    fullMoon: true,
    vocAlert: true,
    highQuality: false,
  },
  display: {
    railSections: ["moon", "aspects", "retrogrades", "hour", "transits"],
    autoRollover: true,
    todayShowVOC: true,
    todayShowWave: true,
    todayShow14Day: true,
    todayShowJournal: true,
    compactRail: false,
    timeFormat: "12h",
    todayShowCrossings: true,
    skyLanguage: "plain",
    astroDetail: "medium",
    uiDensity: "essential",
    // "The reading" starts folded. It arrived from Today, a page built to be
    // read, onto one built to be acted on — so it opens on request rather
    // than claiming the band above the day's work on a first visit. Everything
    // else starts open; a module nobody has met yet should not be hidden.
    collapsedModules: ["reading"],
  },
  timing: {
    watchPlanets: [],
    defaultWindowType: "",
  },
  version: 1,
};

/**
 * Fill a stored (or downloaded) blob out to a complete preferences object.
 *
 * Every unknown key is defaulted rather than assumed, which is what lets a
 * new preference ship without a migration and lets an OLDER client read a
 * newer object without losing the keys it does not know about.
 */
export function mergePreferences(parsed: Partial<TidesPreferences> | null | undefined): TidesPreferences {
  if (!parsed || typeof parsed !== "object") return DEFAULT_PREFS;
  const display = { ...DEFAULT_PREFS.display, ...parsed.display };
  // A stored blob predating this key, or one corrupted to a non-array, must
  // not make `.includes` throw on every render of every module.
  if (!Array.isArray(display.collapsedModules)) display.collapsedModules = [];
  // Migration: an EXISTING user (saved prefs) who never chose an astro level
  // keeps the full experience they're used to — only brand-new users get the
  // friendlier "medium" default (and are asked in intake).
  if (parsed.display && parsed.display.astroDetail === undefined) display.astroDetail = "full";
  return {
    notifications: { ...DEFAULT_PREFS.notifications, ...parsed.notifications },
    display,
    timing: { ...DEFAULT_PREFS.timing, ...parsed.timing },
    version: parsed.version ?? 1,
    savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
  };
}

export function loadPreferences(): TidesPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return mergePreferences(JSON.parse(raw) as Partial<TidesPreferences>);
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Write to localStorage and return the STAMPED object.
 *
 * Returning it matters: the caller holds this in state and hands it to the
 * server push, so if the stamp existed only in storage the two copies would
 * disagree about when they were written — and the tie-break that decides
 * which device wins would be reading a savedAt that is always one edit stale.
 */
export function savePreferences(prefs: TidesPreferences): TidesPreferences {
  const stamped = { ...prefs, savedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(stamped));
  return stamped;
}

// ── Across devices ──────────────────────────────────────────────────────────
// localStorage stays the SYNCHRONOUS source: the first frame has to render at
// the right density and the right lens without waiting for a round trip, and
// a page that reflows once the network answers is worse than one that is
// briefly a device behind. The server copy is what follows a person to a new
// device (audit 2026-08-19 §7).

/**
 * WHICH COPY WINS when a device's own preferences and the server's disagree.
 *
 * Exported and pure so the rule is testable. "Last write wins" is only true
 * if something records WHEN each was written; without `savedAt` the rule is
 * really "whoever loaded most recently wins", which throws away the newer
 * edit every time a second device opens the app — and on a per-device session
 * model the device that opened second is not the wrong one.
 *
 *   "remote"  the shared copy is newer; adopt it
 *   "local"   this device is ahead; seed the column so the NEXT device gets it
 *   "neither" they agree, or there is nothing to compare
 *
 * A blob written before the stamp existed reads as 0 and loses to any stamped
 * copy, which is the right way round for a first sync.
 */
export function choosePreferences(
  local: TidesPreferences,
  remote: TidesPreferences | null,
): "remote" | "local" | "neither" {
  const l = local.savedAt ?? 0;
  const r = remote?.savedAt ?? 0;
  if (remote && r > l) return "remote";
  if (l > r) return "local";
  return "neither";
}

/** The stored copy, or null when there is none / it cannot be read. */
export async function fetchServerPreferences(testerId: string): Promise<TidesPreferences | null> {
  try {
    const r = await fetch("/api/account/prefs", { headers: { "x-tester-id": testerId } });
    if (!r.ok) return null;
    const body = await r.json() as { prefs?: Partial<TidesPreferences> | null };
    return body?.prefs ? mergePreferences(body.prefs) : null;
  } catch {
    // An unreachable server is not a reason to reset anyone's settings. The
    // local copy is already correct for this device; it simply does not travel
    // until the next successful write.
    return null;
  }
}

/** Push the whole object up. Failure is silent by design — see above. */
export async function pushServerPreferences(testerId: string, prefs: TidesPreferences): Promise<void> {
  try {
    await fetch("/api/account/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tester-id": testerId },
      body: JSON.stringify({ prefs: { ...prefs, savedAt: prefs.savedAt ?? Date.now() } }),
    });
  } catch { /* offline; the local copy still stands */ }
}

// Set just the astro-detail level — used by the onboarding intake, which runs
// OUTSIDE the preferences provider, so it writes to storage for the provider to
// pick up when it mounts after onboarding completes.
export function setAstroDetail(level: AstroDetail): void {
  const prefs = loadPreferences();
  prefs.display.astroDetail = level;
  savePreferences(prefs);
}

// Set just the ui density — used by the Today page's "show everything /
// simplify" affordance. NOTE: no migration override for existing users — the
// decluttered default applies to everyone (owner 2026-07-23); expanding is one
// tap and persists.
export function setUiDensity(level: UiDensity): void {
  const prefs = loadPreferences();
  prefs.display.uiDensity = level;
  savePreferences(prefs);
}

export function isQuietHours(prefs: TidesPreferences): boolean {
  const h = new Date().getHours();
  const { quietStart, quietEnd } = prefs.notifications;
  if (quietStart > quietEnd) return h >= quietStart || h < quietEnd;
  return h >= quietStart && h < quietEnd;
}
