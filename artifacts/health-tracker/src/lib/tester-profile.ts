const KEY_ID = "obs_tester_id";
const KEY_NAME = "obs_display_name";

/** The default profile for the original single-user data. */
export const DEFAULT_TESTER_ID = "obs_default_charlie";
export const DEFAULT_TESTER_NAME = "Charlie";

export interface TesterProfile {
  testerId: string;
  displayName: string;
}

function generateTesterId(): string {
  const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `obs_${random}`;
}

/** Load the saved profile from localStorage, or null if none. */
export function loadProfile(): TesterProfile | null {
  const testerId = localStorage.getItem(KEY_ID);
  const displayName = localStorage.getItem(KEY_NAME);
  if (testerId && displayName) return { testerId, displayName };
  return null;
}

/** Persist a profile to localStorage. */
export function saveProfile(profile: TesterProfile): void {
  localStorage.setItem(KEY_ID, profile.testerId);
  localStorage.setItem(KEY_NAME, profile.displayName);
}

/** Create a brand-new profile with a fresh UUID. */
export function createProfile(displayName: string): TesterProfile {
  const profile: TesterProfile = {
    testerId: generateTesterId(),
    displayName: displayName.trim(),
  };
  saveProfile(profile);
  return profile;
}

/** Clear the current profile from localStorage (does not delete server data). */
export function clearProfile(): void {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
}

/** Short version of a tester ID for display — first 12 chars after "obs_". */
export function shortId(testerId: string): string {
  const inner = testerId.startsWith("obs_") ? testerId.slice(4) : testerId;
  return inner.slice(0, 12) + (inner.length > 12 ? "…" : "");
}
