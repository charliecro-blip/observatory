// Palette themes — from the Claude Design "Sign & Planet Palettes" study.
// Four complete looks a user flips between in Settings. This v1 wires each
// theme's SURFACE + TEXT tokens onto the app's existing CSS variables (the
// biggest identity shift — Observatory's cosmic dark, Almanac's warm paper,
// Minimal's stark white). Per-element accent hues, custom fonts, and the
// generative per-sign / per-planet colors from the same study are a follow-up.

export type PaletteKey = "almanac" | "observatory" | "tide" | "minimal";

export interface Palette {
  key: PaletteKey;
  name: string;
  mode: "light" | "dark";
  swatch: string;   // a representative dot for the picker
  vars: Record<string, string>;
}

// Each theme's token set, mapped onto the app's CSS variables. Source hexes are
// the designer's exact values (bg / frame / chartCard / codeBg / chartBorder /
// ink / sub) plus each theme's element hues (kept in --color-* so surfaces that
// read the CSS var pick them up).
export const PALETTES: Palette[] = [
  {
    key: "tide", name: "Tide", mode: "light", swatch: "#3F8493",
    vars: {
      "--color-background": "#F4F2EC",
      "--color-rail": "#ECE9E0",
      "--color-border": "#E6E2D8",
      "--color-card": "#FFFFFF",
      "--color-card-2": "#FAF9F5",
      "--color-foreground": "#1B1A17",
      "--color-muted": "#8E8A7E",
      "--color-primary": "#1B1A17",
      "--color-fire": "#C2613E", "--color-earth": "#5E9A52", "--color-air": "#CBA13C", "--color-water": "#3F8493",
    },
  },
  {
    key: "almanac", name: "Almanac", mode: "light", swatch: "#A2503A",
    vars: {
      "--color-background": "#E9E1CE",
      "--color-rail": "#DED9CD",
      "--color-border": "#D8CDB0",
      "--color-card": "#F1EAD7",
      "--color-card-2": "#F3ECDA",
      "--color-foreground": "#2B2820",
      "--color-muted": "#7A7259",
      "--color-primary": "#2B2820",
      "--color-fire": "#A2503A", "--color-earth": "#6E7355", "--color-air": "#B28A2E", "--color-water": "#3E6C82",
    },
  },
  {
    key: "observatory", name: "Observatory", mode: "dark", swatch: "#46C2E6",
    vars: {
      "--color-background": "#0B0E14",
      "--color-rail": "#121722",
      "--color-border": "#1E2634",
      "--color-card": "#0E131E",
      "--color-card-2": "#141B27",
      "--color-foreground": "#E7ECF6",
      "--color-muted": "#8A93A6",
      "--color-primary": "#E7ECF6",
      "--color-fire": "#FF7A59", "--color-earth": "#5FC98A", "--color-air": "#F2C94C", "--color-water": "#46C2E6",
    },
  },
  {
    key: "minimal", name: "Minimal", mode: "light", swatch: "#111111",
    vars: {
      "--color-background": "#FFFFFF",
      "--color-rail": "#FAFAFA",
      "--color-border": "#ECECEC",
      "--color-card": "#FFFFFF",
      "--color-card-2": "#FAFAFA",
      "--color-foreground": "#111111",
      "--color-muted": "#9A9A9A",
      "--color-primary": "#111111",
      "--color-fire": "#C24A5E", "--color-earth": "#5A8F52", "--color-air": "#BE9A2E", "--color-water": "#2F8E9C",
    },
  },
];

const KEY = "obs_palette";
const DEFAULT: PaletteKey = "tide";

export function getPaletteKey(): PaletteKey {
  try {
    const k = localStorage.getItem(KEY) as PaletteKey | null;
    return PALETTES.some((p) => p.key === k) ? (k as PaletteKey) : DEFAULT;
  } catch { return DEFAULT; }
}

export function findPalette(key: PaletteKey): Palette {
  return PALETTES.find((p) => p.key === key) ?? PALETTES[0];
}

export function applyPalette(key?: PaletteKey): void {
  const p = findPalette(key ?? getPaletteKey());
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p.vars)) root.style.setProperty(k, v);
  // Keep data-theme in sync so any remaining dark-mode CSS still applies.
  root.setAttribute("data-theme", p.mode);
}

export function setPaletteKey(key: PaletteKey): void {
  try { localStorage.setItem(KEY, key); } catch { /* no-op */ }
  applyPalette(key);
}
