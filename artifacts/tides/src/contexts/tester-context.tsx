import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loadProfile,
  saveProfile,
  saveLocation,
  saveChronotype,
  saveCautionPlanets,
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
  resetProfile: () => void;
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
  const [profile, setProfile] = useState<TesterProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      setProfile(saved);
      setIsReady(true);
    } else {
      setShowModal(true);
    }
  }, []);

  const updateLocation = useCallback((lat: number, lon: number, label: string) => {
    saveLocation(lat, lon, label);
    setProfile(p => p ? { ...p, lat, lon, locationLabel: label } : p);
  }, []);

  const updateChronotype = useCallback((chronotype: Chronotype) => {
    saveChronotype(chronotype);
    setProfile(p => p ? { ...p, chronotype } : p);
  }, []);

  const updateCautionPlanets = useCallback((cautionPlanets: CautionPlanet[]) => {
    saveCautionPlanets(cautionPlanets);
    setProfile(p => p ? { ...p, cautionPlanets } : p);
  }, []);

  const applyProfile = useCallback((p: TesterProfile) => {
    saveProfile(p);
    setProfile(p);
    
    setIsReady(true);
    setShowModal(false);
  }, []);

  const createAndApply = useCallback((displayName: string): TesterProfile => {
    const p = createProfile(displayName.trim() || "Observer");
    setProfile(p);
    
    setIsReady(true);
    setShowModal(false);
    return p;
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
