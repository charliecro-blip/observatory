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
import { loadSessionToken, saveSessionToken, clearSessionToken, SESSION_INVALID_EVENT, type SessionInvalidDetail } from "@/lib/session";

interface TesterContextValue {
  profile: TesterProfile | null;
  isReady: boolean;
  showModal: boolean;
  /** The server refused this device's session and every silent repair failed
   *  — the one state where the person must present the account key. */
  sessionBlocked: boolean;
  lat: number;
  lon: number;
  /**
   * Whether `lat`/`lon` are the user's ACTUAL location or a timezone guess.
   *
   * Without this the two were indistinguishable: the provider silently
   * substituted fallback coordinates and every consumer received plausible
   * numbers with no way to know they were invented. That is tolerable for a
   * rough element reading and NOT tolerable for planetary hours, which are
   * derived from local sunrise and sunset — a guessed meridian shifts every
   * hour boundary, and the app was presenting those shifted times as fact
   * behind a "hours are estimated" caption. The owner's standing rule applies:
   * if it needs a disclaimer, the design is wrong. Hours are now withheld
   * until this is true rather than estimated and apologised for.
   */
  locationKnown: boolean;
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
    // A CREATED account (201) is claimed from birth — its session arrives
    // beside the recovery code, once.
    if (data?.sessionToken) saveSessionToken(data.sessionToken);
  } catch {
    // offline or server down — retry on the next profile change
  }
}

const TesterContext = createContext<TesterContextValue | null>(null);

/** In-flight latch for ensureSession — module scope so remounts and parallel
 *  providers share ONE claim attempt. See the comment at the call site. */
let ensureSessionInFlight = false;

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

  /**
   * THE SESSION BRAIN (BACKLOG §2's last open item, closed 2026-08-16).
   *
   * Holding an identity without a session, this account is either
   * pre-sessions (claim it — trust on first use) or this is a second device
   * of an already-claimed account (the claim 403s; prove ownership with the
   * recovery code this device already keeps from an earlier sync, silently).
   * Only when BOTH fail does the person see anything: the restore modal,
   * asking for the key — the same screen a new device always used.
   *
   * The same routine answers a mid-session 401 (session revoked elsewhere,
   * or the account claimed by another device while this tab sat open),
   * relayed by the fetch interceptor as SESSION_INVALID_EVENT. One attempt
   * per trigger — a loop of claim/restore against a server saying no is a
   * hammering, not a recovery.
   */
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const ensureSession = useCallback(async (p: TesterProfile) => {
    // MODULE-level in-flight guard, not a ref: StrictMode remounts (and a
    // second open tab's boot) create fresh refs, and two concurrent runs
    // produced exactly the race this comment now prevents — the loser's
    // claim 403'd, its recovery failed, and its failure path cleared the
    // token the winner had just saved. Measured in the live walkthrough of
    // this very feature.
    if (ensureSessionInFlight) return;
    ensureSessionInFlight = true;
    try {
      if (loadSessionToken()) { setSessionBlocked(false); return; } // someone already won
      const claim = await fetch("/api/account/claim", {
        method: "POST",
        headers: { "x-tester-id": p.testerId },
      });
      if (claim.ok) {
        const data = await claim.json();
        if (data?.sessionToken) { saveSessionToken(data.sessionToken); setSessionBlocked(false); }
        return;
      }
      if (claim.status === 404) return; // profile not synced yet — sync path mints instead
      // Claimed by another device. The recovery code this device already
      // holds is the proof of ownership; use it without asking.
      const code = p.recoveryCode;
      if (code) {
        const r = await fetch("/api/account/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.sessionToken) { saveSessionToken(data.sessionToken); setSessionBlocked(false); return; }
        }
        // Rate-limited is "again in a minute", not "signed out". Blocking here
        // put the scary banner on a healthy account whose only sin was
        // rebooting fast; the next trigger (any 401, or the next boot) retries.
        if (r.status === 429) return;
      }
      // Both repairs failed — but only block if nobody else won meanwhile.
      // Clearing a token some concurrent run just minted is how a failed
      // straggler signs out a healthy device.
      if (!loadSessionToken()) {
        clearSessionToken();
        setSessionBlocked(true);
      }
    } catch {
      // Offline — the gate is also unreachable, so nothing is blocked yet;
      // the next trigger retries.
    } finally {
      ensureSessionInFlight = false;
    }
  }, []);

  useEffect(() => {
    if (profile && !loadSessionToken()) void ensureSession(profile);
  }, [profile, ensureSession]);

  useEffect(() => {
    const onInvalid = (e: Event) => {
      if (!profile) return;
      // A dead token must go before ensureSession runs, or the "someone
      // already won" early-return reads the corpse as a victory and repairs
      // nothing. (Found live: a tampered token 401'd forever while the
      // self-heal politely declined to interfere with it.)
      //
      // But only the token that ACTUALLY failed. The event used to clear
      // storage unconditionally, which is fine while 401s are rare and fatal
      // and wrong the moment they are routine: past the TOFU deadline every
      // dormant account boots into one, because the boot sync fires before
      // this device has any token at all. That 401 carries no token, lands
      // after the repair it raced has already saved a good one, and the old
      // code deleted it — signing out the device the repair had just fixed.
      const failed = (e as CustomEvent<SessionInvalidDetail>).detail?.token ?? null;
      const current = loadSessionToken();
      if (failed && current && current !== failed) return; // already replaced
      if (failed && current === failed) clearSessionToken();
      void ensureSession(profile);
    };
    window.addEventListener(SESSION_INVALID_EVENT, onInvalid);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, onInvalid);
  }, [profile, ensureSession]);

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
      if (data.sessionToken) saveSessionToken(data.sessionToken);
      setSessionBlocked(false);
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
    clearSessionToken();
    clearProfile();
    setProfile(null);
    
    setIsReady(false);
    setShowModal(true);
  }, []);

  const fallback = tzFallbackCoords();
  const locationKnown = profile?.lat != null && profile?.lon != null;
  const lat = profile?.lat ?? fallback.lat;
  const lon = profile?.lon ?? fallback.lon;

  return (
    <TesterContext.Provider
      value={{
        profile,
        isReady,
        showModal,
        sessionBlocked,
        lat,
        lon,
        locationKnown,
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
