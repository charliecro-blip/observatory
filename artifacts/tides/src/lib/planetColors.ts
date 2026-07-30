/**
 * One planet palette, theme-aware.
 *
 * These hues were copy-pasted into six places (Today ×2, Calendar, Sky, Rail,
 * GuidingStarsHub, SessionTimer) and had already drifted — Venus was #a06080
 * in three of them and #c06090 in the others. More importantly they were the
 * light-mode values everywhere, so on the dark palette Jupiter's #6040a0 sat
 * at 2.3:1 against the card and Saturn's #807060 was barely a shape.
 *
 * Values stay HEX rather than `var(--planet-x)` for the same reason the element
 * hues do: the app concatenates an alpha suffix onto them (`${col}22`), and
 * `var(--x)22` silently resolves to nothing.
 */
const LIGHT: Record<string, string> = {
  Sun: "#c08020", Moon: "#7080a0", Mercury: "#608060", Venus: "#a06080",
  Mars: "#c04040", Jupiter: "#6040a0", Saturn: "#807060", Uranus: "#3090a0",
  Neptune: "#5060b0", Pluto: "#703060", Earth: "#4a7040",
};

// Lifted for a dark ground — same hue, enough luminance to clear 4.5:1 on the
// card surfaces. Not simply "lighter": each is nudged to keep the planet
// recognisable next to its neighbours (Mars must not drift toward Venus).
const DARK: Record<string, string> = {
  Sun: "#e0aa48", Moon: "#a4b4d4", Mercury: "#8cbb8c", Venus: "#e090b4",
  Mars: "#e97070", Jupiter: "#a288e8", Saturn: "#bda98c", Uranus: "#54c4d8",
  Neptune: "#8a94e0", Pluto: "#c07aa4", Earth: "#7cc06c",
};

const FALLBACK_LIGHT = "#8a8278";
const FALLBACK_DARK = "#9aa3b4";

function isDark(): boolean {
  return typeof document !== "undefined"
    && document.documentElement.getAttribute("data-theme") === "dark";
}

/** The hue for a planet under the active theme. Always a 7-char hex. */
export function planetColor(planet: string): string {
  const table = isDark() ? DARK : LIGHT;
  return table[planet] ?? (isDark() ? FALLBACK_DARK : FALLBACK_LIGHT);
}

/**
 * Drop-in replacement for the old `Record<string, string>` maps — a Proxy so
 * `PLANET_COLORS[p]` and `${PLANET_COLORS[p]}22` both keep working unchanged
 * at every existing call site, while the value follows the theme.
 */
export const PLANET_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => (typeof key === "string" ? planetColor(key) : undefined),
  has: (_t, key: string) => key in LIGHT,
  ownKeys: () => Reflect.ownKeys(LIGHT),
  getOwnPropertyDescriptor: (_t, key: string) => ({
    value: planetColor(key), enumerable: true, configurable: true,
  }),
});

export const PLANET_NAMES = Object.keys(LIGHT);
