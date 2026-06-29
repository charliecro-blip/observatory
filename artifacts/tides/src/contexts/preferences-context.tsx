import React, { createContext, useContext, useState, useCallback } from "react";
import {
  TidesPreferences,
  NotificationPrefs,
  DisplayPrefs,
  TimingPrefs,
  loadPreferences,
  savePreferences,
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
