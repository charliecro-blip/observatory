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
  },
  timing: {
    watchPlanets: [],
    defaultWindowType: "",
  },
  version: 1,
};

export function loadPreferences(): TidesPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TidesPreferences>;
    const display = { ...DEFAULT_PREFS.display, ...parsed.display };
    // Migration: an EXISTING user (saved prefs) who never chose an astro level
    // keeps the full experience they're used to — only brand-new users get the
    // friendlier "medium" default (and are asked in intake).
    if (parsed.display && parsed.display.astroDetail === undefined) display.astroDetail = "full";
    return {
      notifications: { ...DEFAULT_PREFS.notifications, ...parsed.notifications },
      display,
      timing: { ...DEFAULT_PREFS.timing, ...parsed.timing },
      version: parsed.version ?? 1,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: TidesPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
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
