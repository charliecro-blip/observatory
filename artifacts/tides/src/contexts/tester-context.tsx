import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loadProfile,
  saveProfile,
  createProfile,
  clearProfile,
  DEFAULT_TESTER_ID,
  DEFAULT_TESTER_NAME,
  type TesterProfile,
} from "@/lib/tester-profile";

interface TesterContextValue {
  profile: TesterProfile | null;
  isReady: boolean;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  applyProfile: (profile: TesterProfile) => void;
  createAndApply: (displayName: string) => TesterProfile;
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

  return (
    <TesterContext.Provider
      value={{
        profile,
        isReady,
        showModal,
        openModal: () => setShowModal(true),
        closeModal: () => setShowModal(false),
        applyProfile,
        createAndApply,
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
