// HTML escaping for every string that reaches innerHTML. One shared
// implementation so the rule is testable and no page grows its own variant:
// anything user-typed (names, places) or fetched (geocoder labels) is either
// escaped through here or set via textContent/DOM properties, never
// interpolated raw.

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
