import React, { createContext, useContext, useState, useCallback } from "react";
import {
  TidesPreferences,
  NotificationPrefs,
  DisplayPrefs,
  TimingPrefs,
  loadPreferences,
  savePreferences,
  astroReveal,
} from "@/lib/preferences";

interface PreferencesContextValue {
  prefs: TidesPreferences;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  updateDisplay: (patch: Partial<DisplayPrefs>) => void;
  updateTiming: (patch: Partial<TimingPrefs>) => void;
}

const Ctx = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<TidesPreferences>(() => loadPreferences());

  const update = useCallback((patch: Partial<TidesPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);

  const updateNotifications = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, notifications: { ...prev.notifications, ...patch } };
      savePreferences(next);
      return next;
    });
  }, []);

  const updateDisplay = useCallback((patch: Partial<DisplayPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, display: { ...prev.display, ...patch } };
      savePreferences(next);
      return next;
    });
  }, []);

  const updateTiming = useCallback((patch: Partial<TimingPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, timing: { ...prev.timing, ...patch } };
      savePreferences(next);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ prefs, updateNotifications, updateDisplay, updateTiming }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences outside PreferencesProvider");
  return ctx;
}

// How much astrology to show, and what that reveals — one hook every surface
// reads so "minimal / medium / full" gates identically everywhere.
export function useAstroDetail() {
  const { prefs } = usePreferences();
  const level = prefs.display.astroDetail ?? "full";
  return { level, ...astroReveal(level) };
}

// How much is on screen — "essential" (the core journey: compass, plan, aims)
// vs "expanded" (the full instrument panel). One hook so every surface gates
// identically; `essential` reads as "hide the add-ons".
export function useUiDensity() {
  const { prefs, updateDisplay } = usePreferences();
  const density = prefs.display.uiDensity ?? "essential";
  return {
    density,
    essential: density === "essential",
    setDensity: (d: "essential" | "expanded") => updateDisplay({ uiDensity: d }),
  };
}

export function useTimeFormat() {
  const { prefs } = usePreferences();
  const is24 = prefs.display.timeFormat === "24h";
  return function fmtT(d: Date | string): string {
    const dt = typeof d === "string" ? new Date(d) : d;
    if (is24) return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const h = dt.getHours(), m = dt.getMinutes();
    const suffix = h >= 12 ? "pm" : "am";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
  };
}
