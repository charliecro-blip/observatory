import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { logEvent } from "@/lib/analytics";
import { useTester } from "@/contexts/tester-context";
import {
  TidesPreferences,
  NotificationPrefs,
  DisplayPrefs,
  TimingPrefs,
  loadPreferences,
  savePreferences,
  choosePreferences,
  fetchServerPreferences,
  pushServerPreferences,
  astroReveal,
} from "@/lib/preferences";

interface PreferencesContextValue {
  prefs: TidesPreferences;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  updateDisplay: (patch: Partial<DisplayPrefs> | ((prev: DisplayPrefs) => Partial<DisplayPrefs>)) => void;
  updateTiming: (patch: Partial<TimingPrefs>) => void;
  /**
   * A running session forces the astro-quiet lens for as long as it runs —
   * the one-tap door into flow mode for people who will never open Settings.
   * Context state only, never persisted: the stored preference is untouched,
   * and the lens returns the moment the session ends (or the tab reloads).
   */
  sessionQuiet: boolean;
  setSessionQuiet: (on: boolean) => void;
}

const Ctx = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  // localStorage during the FIRST render, never in an effect: the lens and
  // the density decide what the first frame draws, and reading them a tick
  // late means every reload flashes the full instrument panel at someone who
  // asked for the quiet one.
  const [prefs, setPrefs] = useState<TidesPreferences>(() => loadPreferences());
  const [sessionQuiet, setSessionQuiet] = useState(false);
  const testerId = useTester().profile?.testerId ?? null;

  // The server copy is what follows a person to a new device (audit
  // 2026-08-19 §7). It is adopted only when it is genuinely NEWER than what
  // this device holds — on a per-device session model the second device to
  // open the app is not automatically the wrong one, and a plain
  // server-always-wins rule would discard whichever edit happened to be made
  // on the device that opened second.
  //
  // A `savedAt` of 0 (a blob written before the stamp existed) loses to any
  // stamped copy, which is the right way round for a first sync.
  const pushed = useRef<string | null>(null);
  useEffect(() => {
    if (!testerId) return;
    let cancelled = false;
    (async () => {
      const remote = await fetchServerPreferences(testerId);
      if (cancelled) return;
      const winner = choosePreferences(prefs, remote);
      if (winner === "remote" && remote) {
        savePreferences(remote);
        setPrefs(remote);
        logEvent("prefs_adopted_remote", {});
      } else if (winner === "local") {
        // This device is ahead — seed the shared copy so the NEXT device gets
        // it. Without this the column stays null until someone happens to
        // change a setting, and the feature would look broken to the one
        // person most likely to test it: someone who set everything up on one
        // device and then opened another.
        void pushServerPreferences(testerId, prefs);
      }
    })();
    return () => { cancelled = true; };
    // Once per identity. Re-running on every preference change would race the
    // push below and could adopt a copy mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerId]);

  // One commit path for every setter, so no update can reach localStorage
  // without also reaching the server.
  const commit = useCallback((next: TidesPreferences) => {
    const stamped = savePreferences(next);
    if (testerId) {
      const key = JSON.stringify(stamped);
      if (pushed.current !== key) {
        pushed.current = key;
        void pushServerPreferences(testerId, stamped);
      }
    }
    return stamped;
  }, [testerId]);

  const update = useCallback((patch: Partial<TidesPreferences>) => {
    setPrefs(prev => commit({ ...prev, ...patch }));
  }, [commit]);

  const updateNotifications = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs(prev => commit({ ...prev, notifications: { ...prev.notifications, ...patch } }));
  }, [commit]);

  /**
   * `patch` may be a function of the CURRENT display prefs.
   *
   * Without that form, a caller computing its patch from the render's own
   * snapshot loses every update but the last when two land in one tick.
   * Measured: folding four dashboard modules in a single tick stored one —
   * each toggle read the same empty array and wrote a one-element one over
   * the others. Rare when a person clicks, certain under React's batching.
   */
  const updateDisplay = useCallback((
    patch: Partial<DisplayPrefs> | ((prev: DisplayPrefs) => Partial<DisplayPrefs>),
  ) => {
    setPrefs(prev => commit({
      ...prev,
      display: { ...prev.display, ...(typeof patch === "function" ? patch(prev.display) : patch) },
    }));
  }, [commit]);

  const updateTiming = useCallback((patch: Partial<TimingPrefs>) => {
    setPrefs(prev => commit({ ...prev, timing: { ...prev.timing, ...patch } }));
  }, [commit]);

  return (
    <Ctx.Provider value={{ prefs, updateNotifications, updateDisplay, updateTiming, sessionQuiet, setSessionQuiet }}>
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
// reads so "minimal / medium / full" gates identically everywhere. A running
// session overrides the stored level to "minimal" (see sessionQuiet above);
// surfaces that want to say WHY the sky went quiet can read the flag.
export function useAstroDetail() {
  const { prefs, sessionQuiet } = usePreferences();
  const stored = prefs.display.astroDetail ?? "full";
  const level = sessionQuiet ? "minimal" : stored;
  return { level, sessionQuiet, ...astroReveal(level) };
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
    setDensity: (d: "essential" | "expanded") => {
      logEvent("density_toggle", { to: d }); // one hook = every toggle surface logged
      updateDisplay({ uiDensity: d });
    },
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
