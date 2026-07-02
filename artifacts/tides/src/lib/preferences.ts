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
    return {
      notifications: { ...DEFAULT_PREFS.notifications, ...parsed.notifications },
      display: { ...DEFAULT_PREFS.display, ...parsed.display },
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

export function isQuietHours(prefs: TidesPreferences): boolean {
  const h = new Date().getHours();
  const { quietStart, quietEnd } = prefs.notifications;
  if (quietStart > quietEnd) return h >= quietStart || h < quietEnd;
  return h >= quietStart && h < quietEnd;
}
