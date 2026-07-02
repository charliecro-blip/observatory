import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loadProfile,
  saveProfile,
  saveLocation,
  saveChronotype,
  createProfile,
  clearProfile,
  DEFAULT_TESTER_ID,
  DEFAULT_TESTER_NAME,
  type TesterProfile,
  type Chronotype,
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
  resetProfile: () => void;
}

const TesterContext = createContext<TesterContextValue | null>(null);

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

  const lat = profile?.lat ?? 40.7;
  const lon = profile?.lon ?? -74.0;

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
