import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  loadProfile,
  saveProfile,
  saveLocation,
  saveChronotype,
  saveCautionPlanets,
  saveRecoveryCode,
  createProfile,
  clearProfile,
  DEFAULT_TESTER_ID,
  DEFAULT_TESTER_NAME,
  type TesterProfile,
  type Chronotype,
  type CautionPlanet,
} from "@/lib/tester-profile";

interface TesterContextValue {
  profile: TesterProfile | null;
  isReady: boolean;
  showModal: boolean;
  lat: number;
  lon: number;
  openModal: () => void;
  closeModal: () => void;
  applyProfile: (profile: TesterProfile) => void;
  createAndApply: (displayName: string) => TesterProfile;
  updateLocation: (lat: number, lon: number, label: string) => void;
  updateChronotype: (chronotype: Chronotype) => void;
  updateCautionPlanets: (planets: CautionPlanet[]) => void;
  restoreFromCode: (code: string) => Promise<{ ok: boolean; message?: string }>;
  resetProfile: () => void;
}

// Push the profile to the server (upsert) and pull back the account key.
// Fire-and-forget from the UI's perspective — a failed sync never blocks the
// app, it just means the key isn't minted yet; the next change retries.
async function syncAccount(p: TesterProfile, onCode: (code: string) => void) {
  try {
    const r = await fetch("/api/account/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tester-id": p.testerId },
      body: JSON.stringify({
        displayName: p.displayName,
        chronotype: p.chronotype ?? null,
        cautionPlanets: p.cautionPlanets ?? null,
        lat: p.lat ?? null,
        lon: p.lon ?? null,
        locationLabel: p.locationLabel ?? null,
      }),
    });
    if (!r.ok) return;
    const data = await r.json();
    if (data?.recoveryCode) onCode(data.recoveryCode);
  } catch {
    // offline or server down — retry on the next profile change
  }
}

const TesterContext = createContext<TesterContextValue | null>(null);

// Fallback coordinates by IANA timezone — representative city per zone. The
// planetary-hour grid and sunrise/sunset are location-sensitive: a hardcoded
// New York default put a Central-timezone user's entire hour ladder one slot
// early (NYC sunrise is ~4:30am their clock). Deriving from the browser's
// timezone gets the grid right to within minutes for most users without any
// geolocation prompt; a real location (Settings or the locate button) still
// overrides this.
const TZ_FALLBACK_COORDS: Record<string, { lat: number; lon: number }> = {
  "America/New_York":    { lat: 40.7,  lon: -74.0 },
  "America/Detroit":     { lat: 42.3,  lon: -83.0 },
  "America/Toronto":     { lat: 43.7,  lon: -79.4 },
  "America/Chicago":     { lat: 41.9,  lon: -87.6 },
  "America/Winnipeg":    { lat: 49.9,  lon: -97.1 },
  "America/Denver":      { lat: 39.7,  lon: -105.0 },
  "America/Edmonton":    { lat: 53.5,  lon: -113.5 },
  "America/Phoenix":     { lat: 33.4,  lon: -112.1 },
  "America/Los_Angeles": { lat: 34.1,  lon: -118.2 },
  "America/Vancouver":   { lat: 49.3,  lon: -123.1 },
  "America/Anchorage":   { lat: 61.2,  lon: -149.9 },
  "Pacific/Honolulu":    { lat: 21.3,  lon: -157.9 },
  "America/Mexico_City": { lat: 19.4,  lon: -99.1 },
  "America/Sao_Paulo":   { lat: -23.5, lon: -46.6 },
  "America/Argentina/Buenos_Aires": { lat: -34.6, lon: -58.4 },
  "Europe/London":       { lat: 51.5,  lon: -0.1 },
  "Europe/Dublin":       { lat: 53.3,  lon: -6.3 },
  "Europe/Lisbon":       { lat: 38.7,  lon: -9.1 },
  "Europe/Paris":        { lat: 48.9,  lon: 2.3 },
  "Europe/Madrid":       { lat: 40.4,  lon: -3.7 },
  "Europe/Berlin":       { lat: 52.5,  lon: 13.4 },
  "Europe/Rome":         { lat: 41.9,  lon: 12.5 },
  "Europe/Amsterdam":    { lat: 52.4,  lon: 4.9 },
  "Europe/Stockholm":    { lat: 59.3,  lon: 18.1 },
  "Europe/Athens":       { lat: 38.0,  lon: 23.7 },
  "Europe/Istanbul":     { lat: 41.0,  lon: 29.0 },
  "Europe/Moscow":       { lat: 55.8,  lon: 37.6 },
  "Asia/Dubai":          { lat: 25.2,  lon: 55.3 },
  "Asia/Karachi":        { lat: 24.9,  lon: 67.0 },
  "Asia/Kolkata":        { lat: 19.1,  lon: 72.9 },
  "Asia/Bangkok":        { lat: 13.8,  lon: 100.5 },
  "Asia/Singapore":      { lat: 1.4,   lon: 103.8 },
  "Asia/Hong_Kong":      { lat: 22.3,  lon: 114.2 },
  "Asia/Shanghai":       { lat: 31.2,  lon: 121.5 },
  "Asia/Tokyo":          { lat: 35.7,  lon: 139.7 },
  "Asia/Seoul":          { lat: 37.6,  lon: 127.0 },
  "Australia/Sydney":    { lat: -33.9, lon: 151.2 },
  "Australia/Melbourne": { lat: -37.8, lon: 145.0 },
  "Australia/Perth":     { lat: -31.9, lon: 115.9 },
  "Pacific/Auckland":    { lat: -36.8, lon: 174.8 },
};

function tzFallbackCoords(): { lat: number; lon: number } {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && TZ_FALLBACK_COORDS[zone]) return TZ_FALLBACK_COORDS[zone];
    // Unknown zone: approximate longitude from the UTC offset (15° per hour).
    // Latitude stays mid-northern — day length will be roughly right for most
    // of the user base, and anything beats a fixed wrong meridian.
    const offsetMin = -new Date().getTimezoneOffset(); // minutes EAST of UTC
    return { lat: 40, lon: Math.max(-180, Math.min(180, offsetMin / 4)) };
  } catch {
    return { lat: 40.7, lon: -74.0 };
  }
}

export function TesterProvider({ children }: { children: React.ReactNode }) {
  // Read localStorage DURING the first render, not in an effect. loadProfile is
  // synchronous, so an effect bought nothing and cost a whole render at the
  // wrong coordinates: lat/lon fell back to the timezone guess, every
  // location-keyed query fired against it, and the profile's real coordinates
  // then changed the query key and fired the same requests a second time
  // (measured: /api/tides/now and /api/tides/week each twice per cold load,
  // once at 41.9/-87.6 and once at 41.8781/-87.6298).
  const [profile, setProfile] = useState<TesterProfile | null>(loadProfile);
  const [isReady, setIsReady] = useState(() => profile != null);
  const [showModal, setShowModal] = useState(() => profile == null);

  // Absorb the recovery code the server mints and keep the local profile in
  // step with it — used by every sync call below.
  const absorbCode = useCallback((code: string) => {
    saveRecoveryCode(code);
    setProfile(p => (p && p.recoveryCode !== code) ? { ...p, recoveryCode: code } : p);
  }, []);

  // Existing users (pre-account-system) get registered on first load — this is
  // what backfills a recovery key for data created before today. Once per boot:
  // the ref survives StrictMode's remount, which was posting /api/account/sync
  // twice on every dev load.
  // Latched unconditionally on the first run — a brand-new account is synced by
  // createAndApply/applyProfile itself, so an unlatched guard would sync it a
  // second time the moment that new profile landed in state.
  const bootSynced = useRef(false);
  useEffect(() => {
    if (bootSynced.current) return;
    bootSynced.current = true;
    if (profile) void syncAccount(profile, absorbCode);
  }, [profile, absorbCode]);

  const updateLocation = useCallback((lat: number, lon: number, label: string) => {
    saveLocation(lat, lon, label);
    setProfile(p => {
      const next = p ? { ...p, lat, lon, locationLabel: label } : p;
      if (next) void syncAccount(next, absorbCode);
      return next;
    });
  }, [absorbCode]);

  const updateChronotype = useCallback((chronotype: Chronotype) => {
    saveChronotype(chronotype);
    setProfile(p => {
      const next = p ? { ...p, chronotype } : p;
      if (next) void syncAccount(next, absorbCode);
      return next;
    });
  }, [absorbCode]);

  const updateCautionPlanets = useCallback((cautionPlanets: CautionPlanet[]) => {
    saveCautionPlanets(cautionPlanets);
    setProfile(p => {
      const next = p ? { ...p, cautionPlanets } : p;
      if (next) void syncAccount(next, absorbCode);
      return next;
    });
  }, [absorbCode]);

  const applyProfile = useCallback((p: TesterProfile) => {
    saveProfile(p);
    setProfile(p);
    setIsReady(true);
    setShowModal(false);
    void syncAccount(p, absorbCode);
  }, [absorbCode]);

  const createAndApply = useCallback((displayName: string): TesterProfile => {
    const p = createProfile(displayName.trim() || "Observer");
    setProfile(p);
    setIsReady(true);
    setShowModal(false);
    void syncAccount(p, absorbCode);
    return p;
  }, [absorbCode]);

  // Restore an identity from its account key — the other half of the account
  // system. Replaces the local profile wholesale; all server-side data (natal
  // chart, stars, tasks, habits) follows automatically since it keys on the
  // restored tester id.
  const restoreFromCode = useCallback(async (code: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const r = await fetch("/api/account/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, message: data?.message ?? "Couldn't restore that key." };
      const restored: TesterProfile = {
        testerId: data.testerId,
        displayName: data.profile?.displayName ?? "Observer",
        ...(data.profile?.lat != null ? { lat: data.profile.lat } : {}),
        ...(data.profile?.lon != null ? { lon: data.profile.lon } : {}),
        ...(data.profile?.locationLabel ? { locationLabel: data.profile.locationLabel } : {}),
        ...(data.profile?.chronotype ? { chronotype: data.profile.chronotype } : {}),
        ...(data.profile?.cautionPlanets ? { cautionPlanets: data.profile.cautionPlanets } : {}),
        ...(data.profile?.recoveryCode ? { recoveryCode: data.profile.recoveryCode } : {}),
      };
      saveProfile(restored);
      setProfile(restored);
      setIsReady(true);
      setShowModal(false);
      return { ok: true };
    } catch {
      return { ok: false, message: "Couldn't reach the server — try again in a moment." };
    }
  }, []);

  const resetProfile = useCallback(() => {
    clearProfile();
    setProfile(null);
    
    setIsReady(false);
    setShowModal(true);
  }, []);

  const fallback = tzFallbackCoords();
  const lat = profile?.lat ?? fallback.lat;
  const lon = profile?.lon ?? fallback.lon;

  return (
    <TesterContext.Provider
      value={{
        profile,
        isReady,
        showModal,
        lat,
        lon,
        openModal: () => setShowModal(true),
        closeModal: () => setShowModal(false),
        applyProfile,
        createAndApply,
        updateLocation,
        updateChronotype,
        updateCautionPlanets,
        restoreFromCode,
        resetProfile,
      }}
    >
      {children}
    </TesterContext.Provider>
  );
}

export function useTester(): TesterContextValue {
  const ctx = useContext(TesterContext);
  if (!ctx) throw new Error("useTester must be used inside TesterProvider");
  return ctx;
}
