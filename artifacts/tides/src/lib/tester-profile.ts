const KEY_ID = "obs_tester_id";
const KEY_NAME = "obs_display_name";
const KEY_LOC = "obs_location";
const KEY_CHRONOTYPE = "obs_chronotype";
const KEY_CAUTION_PLANETS = "obs_caution_planets";

/** The default profile for the original single-user data. */
export const DEFAULT_TESTER_ID = "obs_default_charlie";
export const DEFAULT_TESTER_NAME = "Charlie";

export type ChronotypeProfile = "early_bird" | "night_owl" | "steady" | "napper";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type WindowFlexibility = "rigid" | "flex" | "very_flex";

export interface FreeWindow {
  start: string;   // "HH:MM", 24h
  end: string;     // "HH:MM", 24h
  flexibility: WindowFlexibility;
}

export interface Chronotype {
  profile: ChronotypeProfile;
  description?: string;               // user's own words from onboarding
  freeWindows: Record<Weekday, FreeWindow>;
  updatedAt: string;                  // ISO
}

export const CHRONOTYPE_OPTIONS: { key: ChronotypeProfile; label: string; desc: string }[] = [
  { key: "early_bird", label: "Early bird", desc: "Sharpest in the morning" },
  { key: "night_owl", label: "Night owl", desc: "Comes alive at night" },
  { key: "steady", label: "Steady", desc: "Fairly even through the day" },
  { key: "napper", label: "Napper", desc: "Works in bursts, needs rest between" },
];

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

// "Caution Periods" diagnosis — which planets the user has self-reported as
// personal triggers. Any planet can be one, not just the classic "heavy"
// outer planets — mirrors PLANET_ARCHETYPE in artifacts/api-server/src/lib/natal.ts.
export const CAUTION_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
export type CautionPlanet = (typeof CAUTION_PLANETS)[number];

export const CAUTION_PLANET_ARCHETYPE: Record<CautionPlanet, { label: string; feel: string }> = {
  Sun:     { label: "Ego friction",   feel: "clashes with authority (including your own pride), burnout from overexertion, vitality dips" },
  Moon:    { label: "Emotional",      feel: "moodiness, emotional overwhelm, feeling reactive or easily thrown" },
  Mercury: { label: "Mental",         feel: "miscommunication, mental fog or scatter, decision paralysis, information overload" },
  Venus:   { label: "Relational",     feel: "relationship friction, overspending, aesthetic or values clashes, feeling under-appreciated" },
  Mars:    { label: "Combustible",    feel: "irritability, conflict, impulsiveness, accidents, frustration boiling over" },
  Uranus:  { label: "Disruptive",     feel: "sudden shifts, things breaking from routine, feeling knocked off course" },
  Neptune: { label: "Hazy / diffuse", feel: "fog, low motivation, sleepiness, things feeling unclear or hard to pin down" },
  Saturn:  { label: "Heavy",          feel: "weight, restriction, anxiety, a sense of being tested or held back" },
  Pluto:   { label: "Intense",        feel: "high stakes, power struggles, things feeling scarier or more consequential than usual" },
  Jupiter: { label: "Excess",         feel: "overdoing it — overcommitting, overspending, overindulging" },
};

export interface TesterProfile {
  testerId: string;
  displayName: string;
  lat?: number;
  lon?: number;
  locationLabel?: string;
  chronotype?: Chronotype;
  cautionPlanets?: CautionPlanet[];
}

function generateTesterId(): string {
  const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `obs_${random}`;
}

/** Load the saved profile from localStorage, or null if none. */
export function loadProfile(): TesterProfile | null {
  const testerId = localStorage.getItem(KEY_ID);
  const displayName = localStorage.getItem(KEY_NAME);
  if (testerId && displayName) {
    const locRaw = localStorage.getItem(KEY_LOC);
    const loc = locRaw ? JSON.parse(locRaw) : {};
    const chronoRaw = localStorage.getItem(KEY_CHRONOTYPE);
    const chronotype = chronoRaw ? JSON.parse(chronoRaw) : undefined;
    const cautionRaw = localStorage.getItem(KEY_CAUTION_PLANETS);
    const cautionPlanets = cautionRaw ? JSON.parse(cautionRaw) : undefined;
    return {
      testerId, displayName, ...loc,
      ...(chronotype ? { chronotype } : {}),
      ...(cautionPlanets ? { cautionPlanets } : {}),
    };
  }
  return null;
}

/** Persist a profile to localStorage. */
export function saveProfile(profile: TesterProfile): void {
  localStorage.setItem(KEY_ID, profile.testerId);
  localStorage.setItem(KEY_NAME, profile.displayName);
  if (profile.lat != null && profile.lon != null) {
    localStorage.setItem(KEY_LOC, JSON.stringify({ lat: profile.lat, lon: profile.lon, locationLabel: profile.locationLabel }));
  }
  if (profile.chronotype) {
    localStorage.setItem(KEY_CHRONOTYPE, JSON.stringify(profile.chronotype));
  }
  if (profile.cautionPlanets) {
    localStorage.setItem(KEY_CAUTION_PLANETS, JSON.stringify(profile.cautionPlanets));
  }
}

/** Save location separately (e.g. from Settings page). */
export function saveLocation(lat: number, lon: number, label: string): void {
  localStorage.setItem(KEY_LOC, JSON.stringify({ lat, lon, locationLabel: label }));
}

/** Save chronotype separately (from onboarding or Settings). */
export function saveChronotype(chronotype: Chronotype): void {
  localStorage.setItem(KEY_CHRONOTYPE, JSON.stringify(chronotype));
}

/** Save self-reported caution-period planets (from the questionnaire). */
export function saveCautionPlanets(planets: CautionPlanet[]): void {
  localStorage.setItem(KEY_CAUTION_PLANETS, JSON.stringify(planets));
}

/**
 * Create a profile for a new user. Reuses a tester ID already stashed in
 * localStorage if present — the onboarding name step generates a temp ID and
 * saves it here so it can POST natal-chart data before the profile officially
 * exists. Generating a fresh ID here instead would orphan that birth data
 * under the old ID, and the app would re-prompt for birth info right after
 * onboarding completes (the "asks for my info twice" bug).
 */
export function createProfile(displayName: string): TesterProfile {
  const profile: TesterProfile = {
    testerId: localStorage.getItem(KEY_ID) || generateTesterId(),
    displayName: displayName.trim(),
  };
  saveProfile(profile);
  return profile;
}

/** Clear the current profile from localStorage (does not delete server data). */
export function clearProfile(): void {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_LOC);
  localStorage.removeItem(KEY_CHRONOTYPE);
  localStorage.removeItem(KEY_CAUTION_PLANETS);
}

/** Short version of a tester ID for display — first 12 chars after "obs_". */
export function shortId(testerId: string): string {
  const inner = testerId.startsWith("obs_") ? testerId.slice(4) : testerId;
  return inner.slice(0, 12) + (inner.length > 12 ? "…" : "");
}
