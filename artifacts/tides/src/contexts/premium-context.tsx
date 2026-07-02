import React, { createContext, useContext, useState, useCallback } from "react";

const KEY = "obs_premium_dev_override";

// No billing exists yet — this defaults to UNLOCKED so nothing already built
// gets hidden by default. The Settings toggle lets you flip to "locked" to
// preview the paywall/teaser experience. Swap this for a real entitlement
// check (subscription status from the backend) once billing exists — nothing
// else in the app should need to change, since everything reads through
// usePremium().unlocked.
function readInitial(): boolean {
  return localStorage.getItem(KEY) !== "locked";
}

interface PremiumContextValue {
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlockedState] = useState<boolean>(readInitial);

  const setUnlocked = useCallback((v: boolean) => {
    localStorage.setItem(KEY, v ? "unlocked" : "locked");
    setUnlockedState(v);
  }, []);

  return (
    <PremiumContext.Provider value={{ unlocked, setUnlocked }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used inside PremiumProvider");
  return ctx;
}
