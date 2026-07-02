const KEY_ID = "obs_tester_id";
const KEY_NAME = "obs_display_name";
const KEY_LOC = "obs_location";

/** The default profile for the original single-user data. */
export const DEFAULT_TESTER_ID = "obs_default_charlie";
export const DEFAULT_TESTER_NAME = "Charlie";

export interface TesterProfile {
  testerId: string;
  displayName: string;
  lat?: number;
  lon?: number;
  locationLabel?: string;
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
    return { testerId, displayName, ...loc };
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
}

/** Save location separately (e.g. from Settings page). */
export function saveLocation(lat: number, lon: number, label: string): void {
  localStorage.setItem(KEY_LOC, JSON.stringify({ lat, lon, locationLabel: label }));
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
}

/** Short version of a tester ID for display — first 12 chars after "obs_". */
export function shortId(testerId: string): string {
  const inner = testerId.startsWith("obs_") ? testerId.slice(4) : testerId;
  return inner.slice(0, 12) + (inner.length > 12 ? "…" : "");
}
