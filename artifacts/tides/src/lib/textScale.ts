// Text-size accessibility. The UI is built in hardcoded px (lots of 9–12px
// text), so a per-element font control isn't feasible without a full rem
// refactor. Instead we scale the whole interface with CSS `zoom` on the root —
// which enlarges text AND touch targets together, and is well-supported in the
// Chromium/WebKit engines Tides runs in. Persisted; applied on load.

const KEY = "obs_text_scale";

export const TEXT_SCALES: { key: string; label: string; scale: number }[] = [
  { key: "default", label: "Default", scale: 1.08 },
  { key: "large",   label: "Large",   scale: 1.2 },
  { key: "larger",  label: "Larger",  scale: 1.32 },
];

export function getTextScale(): string {
  try { return localStorage.getItem(KEY) ?? "default"; } catch { return "default"; }
}

export function applyTextScale(key?: string): void {
  const k = key ?? getTextScale();
  const scale = TEXT_SCALES.find((t) => t.key === k)?.scale ?? 1;
  // `zoom` on <html> rescales the whole tree. Guarded in a try in case a future
  // engine drops support (the app just stays at default size). We also publish
  // the scale as --app-zoom so the fixed app shell can divide its 100dvh height
  // by it and stay exactly one viewport tall (keeping the bottom nav fixed
  // rather than pushed off-screen by the zoom).
  try {
    (document.documentElement.style as unknown as { zoom: string }).zoom = String(scale);
    document.documentElement.style.setProperty("--app-zoom", String(scale));
  } catch { /* no-op */ }
}

export function setTextScale(key: string): void {
  try { localStorage.setItem(KEY, key); } catch { /* no-op */ }
  applyTextScale(key);
}
