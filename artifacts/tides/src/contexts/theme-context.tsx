import React, { createContext, useContext, useEffect, useState } from "react";
import { PALETTES, applyPalette, getPaletteKey, setPaletteKey, findPalette, type PaletteKey } from "@/lib/themes";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;             // derived from the active palette's mode (back-compat)
  toggleTheme: () => void;  // topbar ☾/☀ — flips between a light palette and Observatory
  palette: PaletteKey;
  setPalette: (key: PaletteKey) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "light", toggleTheme: () => {}, palette: "tide", setPalette: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteKey>(() => getPaletteKey());
  // Remember the last LIGHT palette so the dark toggle returns to it.
  const [lastLight, setLastLight] = useState<PaletteKey>(() => {
    const cur = getPaletteKey();
    return findPalette(cur).mode === "light" ? cur : "tide";
  });

  useEffect(() => { applyPalette(palette); }, [palette]);

  const setPalette = (key: PaletteKey) => {
    setPaletteKey(key);
    setPaletteState(key);
    if (findPalette(key).mode === "light") setLastLight(key);
  };

  const theme: Theme = findPalette(palette).mode;
  const toggleTheme = () => setPalette(theme === "dark" ? lastLight : "observatory");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
export { PALETTES };
